import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestFormValues } from "./RequestForm";
import { useSubmission } from "./useSubmission";
import { pl } from "@/lib/i18n/pl";

// Valid form values used across scenarios. Reason is included so the multipart
// body covers the complaint branch (the schema requires it there).
const VALID_VALUES: RequestFormValues = {
  requestType: "complaint",
  category: "smartphone",
  productName: "iPhone 15",
  purchaseDate: "2026-06-01",
  reason: "Pękła obudowa po upadku.",
};

const IMAGE_FILE = new File(["png-bytes"], "photo.png", {
  type: "image/png",
});

/** Builds a fetch Response-like object the hook can consume. */
function res(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

/**
 * Drives the hook through a successful analyze call once the sessions call has
 * resolved. Returns nothing; callers await `submitPromise` to settle the hook.
 */
async function flushMicrotasks() {
  // A single awaited timeout flushes pending promise microtasks without
  // advancing fake timers (which we don't use in the non-rotation tests).
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("useSubmission", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts in idle with no status text", () => {
      const { result } = renderHook(() => useSubmission());

      expect(result.current.state).toEqual({ status: "idle" });
      expect(result.current.statusText).toBeUndefined();
    });
  });

  describe("happy path (ADR-002 sequence diagram)", () => {
    it("transitions creating -> analyzing -> done and posts both endpoints in order", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s1" }) as Response)
        .mockResolvedValueOnce(
          res(true, 200, { decision: { category: "APPROVE" }, sessionId: "s1" }) as Response,
        );
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      expect(result.current.state).toEqual({ status: "done", sessionId: "s1" });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [firstUrl, firstInit] = fetchMock.mock.calls[0];
      const [secondUrl] = fetchMock.mock.calls[1];
      expect(firstUrl).toBe("/api/sessions");
      expect(firstInit?.method).toBe("POST");
      expect(secondUrl).toBe("/api/sessions/s1/analyze");
      expect(secondUrl).toMatch(/^\/api\/sessions\/[^/]+\/analyze$/);
    });

    it("sends the form values and image as multipart/form-data on the create call", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s1" }) as Response)
        .mockResolvedValueOnce(res(true, 200, { sessionId: "s1" }) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeInstanceOf(FormData);
      const body = init.body as FormData;
      expect(body.get("requestType")).toBe("complaint");
      expect(body.get("category")).toBe("smartphone");
      expect(body.get("productName")).toBe("iPhone 15");
      expect(body.get("purchaseDate")).toBe("2026-06-01");
      expect(body.get("reason")).toBe("Pękła obudowa po upadku.");
      const sentFile = body.get("image");
      expect(sentFile).toBeInstanceOf(File);
      expect((sentFile as File).name).toBe("photo.png");
    });

    it("omits the reason field when the form values do not include it (return)", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s2" }) as Response)
        .mockResolvedValueOnce(res(true, 200, { sessionId: "s2" }) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());
      const returnValues: RequestFormValues = {
        requestType: "return",
        category: "laptop",
        productName: "MacBook Air 13",
        purchaseDate: "2026-06-10",
      };

      await act(async () => {
        await result.current.submit(returnValues, IMAGE_FILE);
      });

      const body = fetchMock.mock.calls[0][1].body as FormData;
      expect(body.get("reason")).toBeNull();
    });

    it("exposes the staged Polish status text while creating and analyzing", async () => {
      // Hold the sessions call open so we can observe the `creating` stage,
      // then resolve to observe `analyzing`, then resolve analyze to `done`.
      let resolveSessions!: (v: Response) => void;
      let resolveAnalyze!: (v: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockImplementationOnce(
            () =>
              new Promise<Response>((r) => {
                resolveSessions = r;
              }),
          )
          .mockImplementationOnce(
            () =>
              new Promise<Response>((r) => {
                resolveAnalyze = r;
              }),
          ),
      );

      const { result } = renderHook(() => useSubmission());

      let pending: Promise<void>;
      act(() => {
        pending = result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("creating");
      });
      expect(result.current.statusText).toBe(pl.submission.stages.uploading);

      await act(async () => {
        resolveSessions(res(true, 201, { sessionId: "s1" }) as Response);
        await flushMicrotasks();
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("analyzing");
      });
      expect(result.current.state).toMatchObject({ sessionId: "s1" });
      expect(result.current.statusText).toBe(pl.submission.stages.analyzing);

      await act(async () => {
        resolveAnalyze(
          res(true, 200, { decision: {}, sessionId: "s1" }) as Response,
        );
        await pending;
      });

      expect(result.current.state).toEqual({ status: "done", sessionId: "s1" });
      expect(result.current.statusText).toBeUndefined();
    });

    it("rotates the analyzing text to 'preparing decision' on a timer", async () => {
      // Use a small-but-observable delay so we can assert BOTH the initial
      // and the rotated text under real timers (avoiding the React 19
      // scheduler + fake-timer interaction).
      const ROTATION_MS = 200;
      let resolveAnalyze!: (v: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(res(true, 201, { sessionId: "s1" }) as Response)
          .mockImplementationOnce(
            () =>
              new Promise<Response>((r) => {
                resolveAnalyze = r;
              }),
          ),
      );

      const { result } = renderHook(() =>
        useSubmission({ preparingDecisionDelayMs: ROTATION_MS }),
      );

      let pending!: Promise<void>;
      act(() => {
        pending = result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe("analyzing");
      });
      expect(result.current.statusText).toBe(pl.submission.stages.analyzing);

      // After the rotation delay elapses, the staged text flips.
      await waitFor(
        () => {
          expect(result.current.statusText).toBe(
            pl.submission.stages.preparingDecision,
          );
        },
        { timeout: 2000 },
      );

      // Leaving analyzing (success) clears the staged text.
      await act(async () => {
        resolveAnalyze(res(true, 200, { sessionId: "s1" }) as Response);
        await pending;
      });
      expect(result.current.statusText).toBeUndefined();
    });
  });

  describe("failure handling", () => {
    it("a non-201 response on /api/sessions yields failed(creating) with no session id", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(false, 500, { errors: {} }) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "creating",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("a network error on /api/sessions yields failed(creating)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("network")),
      );

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "creating",
      });
    });

    it("a non-200 response on /analyze yields failed(analyzing) with the stored session id", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s9" }) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "analyzing",
        sessionId: "s9",
      });
      // The form values + file remain mounted: the page can re-submit them.
      expect(result.current.statusText).toBeUndefined();
    });

    it("a 201 response missing sessionId yields failed(creating)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(res(true, 201, {}) as Response),
      );

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });

      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "creating",
      });
    });
  });

  describe("retry semantics (PRD 4.5, AC-28)", () => {
    it("retry after an analyzing failure re-posts ONLY /analyze with the SAME session id", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        // first submit: create ok, analyze fails
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s7" }) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response)
        // retry: analyze succeeds
        .mockResolvedValueOnce(res(true, 200, { sessionId: "s7" }) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });
      expect(result.current.state).toMatchObject({
        status: "failed",
        errorKind: "analyzing",
        sessionId: "s7",
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.state).toEqual({
        status: "done",
        sessionId: "s7",
      });

      // Exactly 3 fetches: 1 create + 2 analyze. No second /sessions POST.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const urls = fetchMock.mock.calls.map((c) => c[0]);
      expect(urls).toEqual([
        "/api/sessions",
        "/api/sessions/s7/analyze",
        "/api/sessions/s7/analyze",
      ]);
    });

    it("a SECOND consecutive analyzing failure escalates to failed(unavailable) with session id", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s7" }) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });
      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "unavailable",
        sessionId: "s7",
      });
    });

    it("a successful retry resets the consecutive-failure counter", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s7" }) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response)
        .mockResolvedValueOnce(res(true, 200, { sessionId: "s7" }) as Response)
        // a subsequent brand-new submit that fails once should be analyzing, not unavailable
        .mockResolvedValueOnce(res(true, 201, { sessionId: "s8" }) as Response)
        .mockResolvedValueOnce(res(false, 502, {}) as Response);
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });
      await act(async () => {
        await result.current.retry();
      });
      expect(result.current.state.status).toBe("done");

      // New submit; a single failure must be "analyzing", not escalated.
      await act(async () => {
        await result.current.submit(VALID_VALUES, IMAGE_FILE);
      });
      expect(result.current.state).toEqual({
        status: "failed",
        errorKind: "analyzing",
        sessionId: "s8",
      });
    });

    it("retry is a no-op unless the machine is in a failed state", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useSubmission());

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.state).toEqual({ status: "idle" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("duplicate-submit suppression (AC-07)", () => {
    it("a rapid second submit while creating produces no additional /sessions request", async () => {
      let resolveSessions!: (v: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockImplementationOnce(
          () =>
            new Promise<Response>((r) => {
              resolveSessions = r;
            }),
        ),
      );
      const fetchMock = globalThis.fetch as unknown as ReturnType<
        typeof vi.fn<typeof fetch>
      >;

      const { result } = renderHook(() => useSubmission());

      const first = result.current.submit(VALID_VALUES, IMAGE_FILE);
      // Synchronous second call before the first await resolves.
      const second = result.current.submit(VALID_VALUES, IMAGE_FILE);

      await waitFor(() => {
        expect(result.current.state.status).toBe("creating");
      });

      // Only the first call hit fetch.
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Release the held promise so the hook can settle and the suite cleans up.
      await act(async () => {
        resolveSessions(res(true, 201, { sessionId: "s1" }) as Response);
        // The analyze call will 404 at runtime; stub it as success so the
        // in-flight submit resolves without errors leaking into other tests.
      });
      // Stub the analyze call that fires next.
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        res(true, 200, { sessionId: "s1" }) as Response,
      );
      await act(async () => {
        await first;
        await second;
      });
    });
  });
});
