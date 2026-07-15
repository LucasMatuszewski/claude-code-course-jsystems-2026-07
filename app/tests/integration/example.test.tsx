import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Trivial component render test. This proves the jsdom environment,
 * @testing-library/react, and the Vite React plugin are wired correctly
 * for Vitest — real integration tests (API routes + temp SQLite) land in
 * P1.x/P2.x per docs/ADR/000-main-architecture.md §10.
 */
function Greeting() {
  return <p>Witaj w Hardware Service Decision Copilot</p>;
}

describe("integration test infrastructure smoke test", () => {
  it("renders a React component in jsdom", () => {
    render(<Greeting />);
    expect(
      screen.getByText("Witaj w Hardware Service Decision Copilot"),
    ).toBeInTheDocument();
  });
});
