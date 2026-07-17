"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pl } from "@/lib/i18n/pl";
import type { SubmissionErrorKind, SubmissionState } from "./useSubmission";

/**
 * ErrorBanner (PRD 9.1 failure state, ADR-002 3 "form area", PRD 4.5)
 * ----------------
 * Two visual variants driven by the failed state's `errorKind`:
 *
 *  - `retry`        - shown for the FIRST analyzing/creating failure. Polish
 *                     message + a "Spróbuj ponownie" button wired to the
 *                     submission machine's `retry()`, plus the session id
 *                     row when one has been issued.
 *  - `unavailable`  - shown after a SECOND consecutive failure. Terminal:
 *                     Polish "service temporarily unavailable" message and
 *                     the persisted session id; no retry affordance.
 *
 * Renders nothing for non-failed states so the page can mount it
 * unconditionally and let the component decide whether to show itself.
 */
export interface ErrorBannerProps {
  /** The current submission state. Only `failed` produces any UI. */
  state: SubmissionState;
  /** Invoked when the customer clicks "Spróbuj ponownie". */
  onRetry: () => void;
  className?: string;
}

export function ErrorBanner({ state, onRetry, className }: ErrorBannerProps) {
  if (state.status !== "failed") {
    return null;
  }

  const { errorKind, sessionId } = state;
  const isUnavailable = errorKind === "unavailable";

  const message = isUnavailable
    ? pl.errorBanner.unavailable.message
    : pl.errorBanner.retry.message;
  const sessionIdLabel = isUnavailable
    ? pl.errorBanner.unavailable.sessionIdLabel
    : pl.errorBanner.retry.sessionIdLabel;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="submission-error-banner"
      data-error-kind={errorKind}
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-play-md)] border border-destructive/40 bg-destructive/5 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <p className="text-sm text-foreground">{message}</p>
      </div>
      {sessionId !== undefined && (
        <dl className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-sm">
          <dt className="font-medium text-text-secondary">{sessionIdLabel}</dt>
          <dd className="font-mono text-foreground">{sessionId}</dd>
        </dl>
      )}
      {!isUnavailable && (
        <div className="pl-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-border-strong"
          >
            {pl.errorBanner.retry.retryButton}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Re-exported so consumers can narrow the error kind without importing the union. */
export type { SubmissionErrorKind };
