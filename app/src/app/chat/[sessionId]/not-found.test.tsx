import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pl } from "@/lib/i18n/pl";

import NotFound from "./not-found";

describe("chat session not-found", () => {
  it("renders the chat-specific Polish not-found state", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: pl.chat.sessionNotFound.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(pl.chat.sessionNotFound.message)).toBeInTheDocument();
  });

  it("links back to the request form", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: pl.chat.sessionNotFound.backLink }),
    ).toHaveAttribute("href", "/");
  });
});
