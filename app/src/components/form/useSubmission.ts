"use client";

import * as React from "react";

import { pl } from "@/lib/i18n/pl";
import type { RequestFormValues } from "./RequestForm";

/**
 * useSubmission (ADR-002 D2-02, PRD 9.1 + 4.5, AC-07, AC-28)
 * ---------------------------------------------
 * Discriminated-union state machine that orchestrates the two-call submission
 * flow (`POST /api/sessions` -> `POST /api/sessions/{id}/analyze`) and the
 * retry-after-failure path.
 *
 * States:
 *  - `idle`         before the customer first submits.
 *  - `creating`     the multipart upload to `/api/sessions` is in flight; the
 *                   submit button reads `pl.submission.stages.uploading`.
 *  - `analyzing`    the analyze call is in flight; the status text starts at
 *                   `pl.submission.stages.analyzing` and rotates to
 *                   `pl.submission.stages.preparingDecision` on a timer.
 *  - `done`         analyze succeeded; the caller navigates to
 *                   `/chat/{sessionId}` (ADR-002 3 "form area").
 *  - `failed`       a call failed; carries an `errorKind` discriminator and,
 *                   if the session was created, the `sessionId` so the page
 *                   can render the banner with the case number.
 *
 * Retry semantics (PRD 4.5): after an analyzing failure, `retry()` re-enters
 * the `analyzing` phase ONLY - it re-POSTs `/analyze` with the SAME session id
 * and does NOT re-upload the form or the image. A SECOND consecutive failure
 * escalates the banner to the `unavailable` variant. A `creating` failure has
 * no session id yet, so `retry()` falls back to a full re-submit using the
 * stored form values + file (the customer does not have to re-enter them -
 * the form stays mounted either way).
 *
 * AC-07: while `creating` or `analyzing`, additional `submit()` calls are
 * ignored via an in-flight ref so rapid double-clicks produce exactly one
 * request pair.
 */

/** Discriminator for the failed state; drives which banner variant renders. */
export type SubmissionErrorKind = "creating" | "analyzing" | "unavailable";

export type SubmissionState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "analyzing"; sessionId: string }
  | { status: "done"; sessionId: string }
  | { status: "failed"; errorKind: SubmissionErrorKind; sessionId?: string };

export interface UseSubmissionResult {
  /** Current state of the machine. Drives every UI behavior in the page. */
  state: SubmissionState;
  /**
   * Polish status text for busy states (`creating`/`analyzing`, including the
   * timer-driven rotation). `undefined` when the machine is not busy so the
   * page can omit the status element entirely.
   */
  statusText: string | undefined;
  /** Start a fresh submission from a valid form + image file. */
  submit: (values: RequestFormValues, imageFile: File) => Promise<void>;
  /** Re-run the analyze call after a failure (PRD 4.5 retry flow). */
  retry: () => Promise<void>;
}

/**
 * How long the analyzing phase shows the initial "Analizuję zdjęcie…" text
 * before rotating to "Przygotowuję decyzję…". The analyze call is synchronous
 * (ADR-000 D4) so this is an approximate progress cue, not real progress.
 */
const PREPARING_DECISION_DELAY_MS = 4000;

/** Options for {@link useSubmission}. */
export interface UseSubmissionOptions {
  /**
   * Override the analyzing-text rotation delay. Exposed for tests so they can
   * exercise the rotation with real timers instead of fighting fake-timer
   * interactions with React's scheduler; the production default is
   * {@link PREPARING_DECISION_DELAY_MS}.
   */
  preparingDecisionDelayMs?: number;
}

export function useSubmission(
  options: UseSubmissionOptions = {},
): UseSubmissionResult {
  const preparingDecisionDelayMs =
    options.preparingDecisionDelayMs ?? PREPARING_DECISION_DELAY_MS;
  const [state, setState] = React.useState<SubmissionState>({ status: "idle" });

  // In-flight guard for AC-07 (rapid duplicate submits). A ref, not state, so
  // it is read synchronously inside `submit`/`retry` without stale closures.
  const inFlightRef = React.useRef(false);

  // Consecutive failure counter. Reset to 0 on a successful analyze or a fresh
  // user-initiated submit. Two consecutive failures escalate to `unavailable`.
  const consecutiveFailuresRef = React.useRef(0);

  // Stored form values + file + session id so retry can re-run without the
  // customer re-entering anything (PRD 4.5 step 3, AC-28).
  const valuesRef = React.useRef<RequestFormValues | null>(null);
  const fileRef = React.useRef<File | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);

  // Sub-stage of the `analyzing` phase (initial vs. rotated). Reset to false
  // at the start of each analyzing phase by `runAnalyzing` (not in an effect,
  // to avoid the react-hooks/set-state-in-effect cascading-render warning).
  const [preparingDecision, setPreparingDecision] = React.useState(false);

  React.useEffect(() => {
    if (state.status !== "analyzing") {
      // No timer to schedule outside the analyzing phase. The staged text
      // memo gates on `status === "analyzing"` so a stale `preparingDecision`
      // value does not leak into other states.
      return;
    }
    const timer = window.setTimeout(() => {
      setPreparingDecision(true);
    }, preparingDecisionDelayMs);
    return () => window.clearTimeout(timer);
  }, [state, preparingDecisionDelayMs]);

  const statusText = React.useMemo<string | undefined>(() => {
    if (state.status === "creating") {
      return pl.submission.stages.uploading;
    }
    if (state.status === "analyzing") {
      return preparingDecision
        ? pl.submission.stages.preparingDecision
        : pl.submission.stages.analyzing;
    }
    return undefined;
  }, [state, preparingDecision]);

  // --- network helpers -----------------------------------------------------

  const postSession = React.useCallback(
    async (values: RequestFormValues, imageFile: File): Promise<string> => {
      const formData = new FormData();
      formData.append("requestType", values.requestType);
      formData.append("category", values.category);
      formData.append("productName", values.productName);
      formData.append("purchaseDate", values.purchaseDate);
      // Reason is undefined for returns without one (schema-optional); send
      // it only when the customer actually provided it.
      if (values.reason !== undefined) {
        formData.append("reason", values.reason);
      }
      formData.append("image", imageFile);

      const response = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`POST /api/sessions failed: ${response.status}`);
      }
      const data = (await response.json()) as { sessionId?: unknown };
      if (typeof data.sessionId !== "string") {
        throw new Error("POST /api/sessions returned no sessionId");
      }
      return data.sessionId;
    },
    [],
  );

  const postAnalyze = React.useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/analyze`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          `POST /api/sessions/${sessionId}/analyze failed: ${response.status}`,
        );
      }
      // Body content is consumed for protocol correctness; the caller
      // navigates by sessionId, not by what is in it.
      await response.json();
    },
    [],
  );

  // --- phase runners -------------------------------------------------------

  const runAnalyzing = React.useCallback(
    async (sessionId: string): Promise<void> => {
      // Reset the staged-text rotation on entry so each analyzing phase
      // starts at "Analizuję zdjęcie…" regardless of how the previous one
      // ended. Done here (in the state-machine transition) rather than in
      // an effect to avoid cascading renders.
      setPreparingDecision(false);
      setState({ status: "analyzing", sessionId });
      try {
        await postAnalyze(sessionId);
        consecutiveFailuresRef.current = 0;
        setState({ status: "done", sessionId });
      } catch {
        consecutiveFailuresRef.current += 1;
        const errorKind: SubmissionErrorKind =
          consecutiveFailuresRef.current >= 2
            ? "unavailable"
            : "analyzing";
        setState({ status: "failed", errorKind, sessionId });
      }
    },
    [postAnalyze],
  );

  const runCreating = React.useCallback(
    async (values: RequestFormValues, imageFile: File): Promise<void> => {
      setState({ status: "creating" });
      let sessionId: string;
      try {
        sessionId = await postSession(values, imageFile);
      } catch {
        consecutiveFailuresRef.current += 1;
        const errorKind: SubmissionErrorKind =
          consecutiveFailuresRef.current >= 2 ? "unavailable" : "creating";
        setState({
          status: "failed",
          errorKind,
          sessionId: sessionIdRef.current ?? undefined,
        });
        return;
      }
      sessionIdRef.current = sessionId;
      await runAnalyzing(sessionId);
    },
    [postSession, runAnalyzing],
  );

  // --- public API ----------------------------------------------------------

  const submit = React.useCallback(
    async (values: RequestFormValues, imageFile: File): Promise<void> => {
      // AC-07: a rapid second submit while one is in flight is a no-op.
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        // Fresh user-initiated submit: persist inputs for a possible later
        // retry and reset the consecutive-failure counter.
        valuesRef.current = values;
        fileRef.current = imageFile;
        sessionIdRef.current = null;
        consecutiveFailuresRef.current = 0;
        await runCreating(values, imageFile);
      } finally {
        inFlightRef.current = false;
      }
    },
    [runCreating],
  );

  const retry = React.useCallback(async (): Promise<void> => {
    // Only meaningful from a failed state.
    if (inFlightRef.current) {
      return;
    }
    const current = state;
    if (current.status !== "failed") {
      return;
    }
    inFlightRef.current = true;
    try {
      // If a session was created, re-enter analyzing ONLY - do NOT re-POST
      // /sessions and do NOT re-enter form data (PRD 4.5 step 3, AC-28).
      const sessionId = sessionIdRef.current;
      if (sessionId !== null) {
        await runAnalyzing(sessionId);
        return;
      }
      // No session id means creating failed: there is no persisted case to
      // retry against, so fall back to a full re-submit using the stored
      // values + file (the counter is NOT reset - a second consecutive
      // failure here also escalates to `unavailable`).
      const values = valuesRef.current;
      const file = fileRef.current;
      if (values === null || file === null) {
        return;
      }
      await runCreating(values, file);
    } finally {
      inFlightRef.current = false;
    }
  }, [runAnalyzing, runCreating, state]);

  return { state, statusText, submit, retry };
}
