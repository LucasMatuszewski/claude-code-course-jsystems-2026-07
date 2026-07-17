import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import { pl } from "@/lib/i18n/pl";
import {
  CATEGORY_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/lib/validation";

// jsdom v29 lacks pointer-capture + scrollIntoView, which radix Select / Popover
// and react-day-picker call during interaction. Scope these no-op polyfills to
// this file (same pattern as RequestForm.test.tsx).
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

const pushMock = vi.fn();

// Mock next/navigation's useRouter so the page can call router.push on done.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

function res(ok: boolean, status: number, body: unknown) {
  return { ok, status, json: async () => body };
}

async function pickRequestType(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(
    screen.getByRole("combobox", { name: pl.form.fields.requestType.label }),
  );
  await user.click(await screen.findByRole("option", { name: label }));
}

async function pickCategory(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(
    screen.getByRole("combobox", { name: pl.form.fields.category.label }),
  );
  await user.click(await screen.findByRole("option", { name: label }));
}

async function clickToday(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: pl.form.fields.purchaseDate.label }),
  );
  const today = new Date().getDate();
  const target = screen
    .getAllByText(String(today))
    .map((el) => el.closest("button"))
    .find((b): b is HTMLElement => !!b && !b.disabled);
  if (!target) throw new Error(`calendar day ${today} not found / not enabled`);
  await user.click(target);
}

describe("Home page (form wiring)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    pushMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the Polish app title and one-sentence description", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: pl.app.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(pl.form.description)).toBeInTheDocument();
  });

  it("renders the RequestForm with the ImageUpload injected into the image slot", () => {
    render(<Home />);

    // Submit button + key field labels are present (RequestForm rendered).
    expect(
      screen.getByRole("button", { name: pl.form.submitButton }),
    ).toBeInTheDocument();
    // The dropzone lives inside the injected ImageUpload.
    expect(screen.getByTestId("image-upload-dropzone")).toBeInTheDocument();
  });

  it("navigates to /chat/{sessionId} after a successful analyze call", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(res(true, 201, { sessionId: "sNav" }) as Response)
      .mockResolvedValueOnce(res(true, 200, { sessionId: "sNav" }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await pickRequestType(user, REQUEST_TYPE_LABELS.complaint);
    await pickCategory(user, CATEGORY_LABELS.smartphone);
    await user.type(
      screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
      "iPhone 15",
    );
    await clickToday(user);
    await user.type(
      screen.getByPlaceholderText(pl.form.fields.reason.placeholder),
      "Pękła obudowa.",
    );

    const file = new File(["bytes"], "photo.png", { type: "image/png" });
    const input = screen
      .getByTestId("image-upload-dropzone")
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/chat/sNav");
    });
  });

  it("renders the retry error banner with the session id when analyze fails (404 from the not-yet-merged endpoint)", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(res(true, 201, { sessionId: "sFail" }) as Response)
      .mockResolvedValueOnce(res(false, 502, {}) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await pickRequestType(user, REQUEST_TYPE_LABELS.return);
    await pickCategory(user, CATEGORY_LABELS.laptop);
    await user.type(
      screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
      "MacBook Air 13",
    );
    await clickToday(user);

    const file = new File(["bytes"], "photo.png", { type: "image/png" });
    const input = screen
      .getByTestId("image-upload-dropzone")
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

    // Retry variant banner + session id rendered.
    expect(await screen.findByText(pl.errorBanner.retry.message)).toBeInTheDocument();
    expect(screen.getByText("sFail")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: pl.errorBanner.retry.retryButton }),
    ).toBeInTheDocument();
    // Form values stay mounted: productName is still in the input.
    expect(
      (screen.getByPlaceholderText(pl.form.fields.productName.placeholder) as HTMLInputElement)
        .value,
    ).toBe("MacBook Air 13");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("re-runs only /analyze when the customer clicks 'Spróbuj ponownie'", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(res(true, 201, { sessionId: "sRetry" }) as Response)
      .mockResolvedValueOnce(res(false, 502, {}) as Response)
      .mockResolvedValueOnce(res(true, 200, { sessionId: "sRetry" }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    await pickRequestType(user, REQUEST_TYPE_LABELS.return);
    await pickCategory(user, CATEGORY_LABELS.laptop);
    await user.type(
      screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
      "MacBook Air 13",
    );
    await clickToday(user);
    const file = new File(["bytes"], "photo.png", { type: "image/png" });
    const input = screen
      .getByTestId("image-upload-dropzone")
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await user.click(screen.getByRole("button", { name: pl.form.submitButton }));
    const retryButton = await screen.findByRole("button", {
      name: pl.errorBanner.retry.retryButton,
    });
    await user.click(retryButton);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/chat/sRetry");
    });

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "/api/sessions",
      "/api/sessions/sRetry/analyze",
      "/api/sessions/sRetry/analyze",
    ]);
  });
});
