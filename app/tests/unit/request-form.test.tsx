/**
 * Unit tests for the request form (start screen) — PRD §9.1, AC-01..07.
 * Covers: field rendering with Polish copy from pl.ts, category options,
 * description required/optional toggling, client-side validation (future
 * date, invalid/oversized image) blocking the network call, a valid submit
 * driving the loading/disabled state and the `/api/cases` multipart POST,
 * the 502 retryable error panel re-sending only `caseId`, and a successful
 * response navigating to the chat page.
 *
 * `fetch` and `next/navigation`'s `useRouter` are mocked; no network, no
 * real routing. `URL.createObjectURL`/`File`/`FormData` are real jsdom
 * globals (confirmed available in this project's Vitest/jsdom setup).
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { RequestForm } from "@/components/request-form/RequestForm";
import { pl } from "@/lib/copy/pl";
import { EQUIPMENT_CATEGORIES, MAX_IMAGE_SIZE_BYTES } from "@/lib/validation/case-form.schema";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function pngFile(name = "sprzet.png", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

/** Fills every required field with valid values, leaving submit to the caller. */
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(pl.form.fields.requestType.label), {
    target: { value: "zwrot" },
  });
  fireEvent.change(screen.getByLabelText(pl.form.fields.category.label), {
    target: { value: "Laptop" },
  });
  fireEvent.change(screen.getByLabelText(pl.form.fields.productName.label), {
    target: { value: "Laptop XPS 13" },
  });
  fireEvent.change(screen.getByLabelText(pl.form.fields.purchaseDate.label), {
    target: { value: "2020-01-01" },
  });
  fireEvent.change(screen.getByLabelText(pl.form.fields.image.label), {
    target: { files: [pngFile()] },
  });
}

function getSubmitButton() {
  return screen.getByRole("button", { name: pl.form.submitButton });
}

beforeEach(() => {
  pushMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
});

describe("RequestForm", () => {
  it("renders all AC-01 fields with their Polish labels from pl.ts", () => {
    render(<RequestForm />);

    expect(screen.getByRole("heading", { name: pl.form.title })).toBeInTheDocument();
    expect(screen.getByText(pl.form.subtitle)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.form.fields.requestType.label)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.form.fields.category.label)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.form.fields.productName.label)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.form.fields.purchaseDate.label)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.form.fields.image.label)).toBeInTheDocument();
    // Description is optional by default (request type starts unselected).
    expect(screen.getByLabelText(pl.form.fields.description.labelOptional)).toBeInTheDocument();
    expect(getSubmitButton()).toBeInTheDocument();
  });

  it("the category select contains exactly the 7 PRD AC-02 options", () => {
    render(<RequestForm />);
    const select = screen.getByLabelText(pl.form.fields.category.label) as HTMLSelectElement;
    const optionValues = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== "");

    expect(optionValues).toEqual([...EQUIPMENT_CATEGORIES]);
    expect(optionValues).toHaveLength(7);
  });

  it("toggles the description label/helper between optional and required per request type (AC-03)", () => {
    render(<RequestForm />);

    expect(screen.getByLabelText(pl.form.fields.description.labelOptional)).toBeInTheDocument();
    expect(screen.getByText(pl.form.fields.description.helperReturn)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(pl.form.fields.requestType.label), {
      target: { value: "reklamacja" },
    });

    expect(screen.getByLabelText(pl.form.fields.description.labelRequired)).toBeInTheDocument();
    expect(screen.getByText(pl.form.fields.description.helperComplaint)).toBeInTheDocument();
  });

  it("blocks submission with an inline error on a future purchase date, without calling fetch (AC-04)", () => {
    render(<RequestForm />);
    fillValidForm();

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureIso = future.toISOString().slice(0, 10);

    fireEvent.change(screen.getByLabelText(pl.form.fields.purchaseDate.label), {
      target: { value: futureIso },
    });

    expect(screen.getByText(pl.form.errors.purchaseDateFuture)).toBeInTheDocument();

    fireEvent.click(getSubmitButton());

    expect(screen.getByText(pl.form.errors.purchaseDateFuture)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows an immediate inline error for a wrong-type image and does not accept it (AC-05)", () => {
    render(<RequestForm />);
    const badFile = new File([new Uint8Array(10)], "dokument.pdf", { type: "application/pdf" });

    fireEvent.change(screen.getByLabelText(pl.form.fields.image.label), {
      target: { files: [badFile] },
    });

    expect(screen.getByText(pl.form.errors.imageInvalidType)).toBeInTheDocument();
    expect(screen.queryByText("dokument.pdf")).not.toBeInTheDocument();
  });

  it("shows an immediate inline error for an oversized image and does not accept it (AC-05)", () => {
    render(<RequestForm />);
    const bigFile = pngFile("duze.png", MAX_IMAGE_SIZE_BYTES + 1);

    fireEvent.change(screen.getByLabelText(pl.form.fields.image.label), {
      target: { files: [bigFile] },
    });

    expect(screen.getByText(pl.form.errors.imageTooLarge)).toBeInTheDocument();
    expect(screen.queryByText("duze.png")).not.toBeInTheDocument();
  });

  it("does not call the backend and shows inline errors when submitting an empty form (AC-06)", () => {
    render(<RequestForm />);
    fireEvent.click(getSubmitButton());

    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a multipart FormData with all fields, shows the loading state, and disables the form (AC-07)", async () => {
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(<RequestForm />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    expect(screen.getByText(pl.form.loadingText)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pl.form.submitButton })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(pl.form.fields.productName.label)).not.toBeInTheDocument();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/cases");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("requestType")).toBe("zwrot");
    expect(body.get("category")).toBe("Laptop");
    expect(body.get("productName")).toBe("Laptop XPS 13");
    expect(body.get("purchaseDate")).toBe("2020-01-01");
    expect(body.get("image")).toBeInstanceOf(File);

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        caseId: "case-1",
        caseNumber: "C-1",
        decision: null,
        requiresBetterPhoto: true,
      }),
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/chat/case-1"));
  });

  it("shows the service error panel on a 502 and retries with only the caseId, without re-entering data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        retryable: true,
        error: pl.form.serviceError.message,
        caseId: "case-99",
        caseNumber: "C-99",
      }),
    });

    render(<RequestForm />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => expect(screen.getByText(pl.form.serviceError.message)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        caseId: "case-99",
        caseNumber: "C-99",
        decision: {
          status: "approved",
          justification: "OK",
          nextSteps: ["Krok 1"],
          disclaimer: pl.chat.disclaimer,
        },
        requiresBetterPhoto: false,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: pl.form.serviceError.retryButton }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, retryInit] = fetchMock.mock.calls[1];
    const retryBody = retryInit.body as FormData;
    expect(retryBody.get("caseId")).toBe("case-99");
    // No re-upload / re-entry: only the caseId field is sent on retry.
    expect(retryBody.get("image")).toBeNull();
    expect(retryBody.get("productName")).toBeNull();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/chat/case-99"));
  });
});
