import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorBanner } from "./ErrorBanner";
import { pl } from "@/lib/i18n/pl";

describe("ErrorBanner", () => {
  describe("retry variant (errorKind = analyzing)", () => {
    it("renders the retry message, retry button and the session id label + value", () => {
      render(
        <ErrorBanner
          state={{ status: "failed", errorKind: "analyzing", sessionId: "abc123" }}
          onRetry={() => {}}
        />,
      );

      expect(
        screen.getByText(pl.errorBanner.retry.message),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: pl.errorBanner.retry.retryButton }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.errorBanner.retry.sessionIdLabel),
      ).toBeInTheDocument();
      expect(screen.getByText("abc123")).toBeInTheDocument();
    });

    it("invokes onRetry when the retry button is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(
        <ErrorBanner
          state={{ status: "failed", errorKind: "analyzing", sessionId: "abc123" }}
          onRetry={onRetry}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: pl.errorBanner.retry.retryButton }),
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("retry variant without a session id (errorKind = creating)", () => {
    it("renders the retry message and button but omits the session id row", () => {
      render(
        <ErrorBanner
          state={{ status: "failed", errorKind: "creating" }}
          onRetry={() => {}}
        />,
      );

      expect(
        screen.getByText(pl.errorBanner.retry.message),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: pl.errorBanner.retry.retryButton }),
      ).toBeInTheDocument();
      // No session id is available, so the label/value row must not appear.
      expect(
        screen.queryByText(pl.errorBanner.retry.sessionIdLabel),
      ).not.toBeInTheDocument();
    });
  });

  describe("unavailable variant (errorKind = unavailable)", () => {
    it("renders the unavailable message and the session id, but no retry button", () => {
      render(
        <ErrorBanner
          state={{
            status: "failed",
            errorKind: "unavailable",
            sessionId: "xyz789",
          }}
          onRetry={() => {}}
        />,
      );

      expect(
        screen.getByText(pl.errorBanner.unavailable.message),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.errorBanner.unavailable.sessionIdLabel),
      ).toBeInTheDocument();
      expect(screen.getByText("xyz789")).toBeInTheDocument();
      // The unavailable variant is terminal: no retry affordance.
      expect(
        screen.queryByRole("button", { name: pl.errorBanner.retry.retryButton }),
      ).not.toBeInTheDocument();
    });
  });

  describe("rendering nothing for non-failed states", () => {
    it("renders nothing when the machine is not in a failed state", () => {
      const { container } = render(
        <ErrorBanner state={{ status: "idle" }} onRetry={() => {}} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
