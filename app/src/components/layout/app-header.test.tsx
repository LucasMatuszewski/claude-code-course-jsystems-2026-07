import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  it("renders the Play logo linking to the home page", () => {
    render(<AppHeader />);

    const link = screen.getByRole("link", { name: "Strona główna" });
    expect(link).toHaveAttribute("href", "/");
    expect(screen.getByAltText("Play")).toBeInTheDocument();
  });

  it("renders the Polish app title and one-sentence explainer", () => {
    render(<AppHeader />);

    expect(
      screen.getByRole("heading", {
        name: "Zwroty i reklamacje — wstępna decyzja online",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/asystent AI przygotuje dla Ciebie wstępną decyzję/i)
    ).toBeInTheDocument();
  });
});
