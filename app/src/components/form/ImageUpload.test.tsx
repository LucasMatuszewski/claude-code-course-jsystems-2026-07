import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageUpload } from "./ImageUpload";
import { pl } from "@/lib/i18n/pl";
import {
  MAX_IMAGE_SIZE_BYTES,
  VALIDATION_MESSAGES_PL,
} from "@/lib/validation";

// jsdom does not implement URL.createObjectURL/revokeObjectURL (it logs
// "Not implemented"). The component relies on both for the preview lifecycle,
// so we stub them once per suite and assert the revoke path is exercised.
// Each call returns a unique URL so the component's `useEffect` sees a real
// state change when a file is swapped (otherwise React would skip the effect
// and skip the cleanup that revokes the previous URL).
let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
let urlCounter = 0;

beforeAll(() => {
  createObjectURLSpy = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementation(() => `blob:fake-preview-${++urlCounter}`);
  revokeObjectURLSpy = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
});

beforeEach(() => {
  createObjectURLSpy.mockClear();
  revokeObjectURLSpy.mockClear();
  urlCounter = 0;
});

const PNG_FIXTURE = new File([new Uint8Array(64)], "sprzet.png", {
  type: "image/png",
});
const JPG_FIXTURE = new File([new Uint8Array(64)], "sprzet.jpg", {
  type: "image/jpeg",
});
const GIF_FIXTURE = new File([new Uint8Array(64)], "meme.gif", {
  type: "image/gif",
});

/** A JPEG whose byte length is exactly N megabytes (1024*1024 each). */
const jpegOfMb = (mb: number): File =>
  new File([new Uint8Array(mb * 1024 * 1024)], `fotografia-${mb}mb.jpg`, {
    type: "image/jpeg",
  });

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="file"]',
  );
  if (!input) {
    throw new Error("Expected a file input to be rendered by ImageUpload");
  }
  return input;
}

/**
 * Dispatches a "drop" event carrying the given files on the target. jsdom
 * does not implement `DataTransfer`/`DragEvent`, so we hand-build a plain
 * Event and attach a `{ files }` object as `dataTransfer` — React's
 * synthetic `onDrop` reads `event.dataTransfer.files`, which is what we
 * provide (verified via a probe test against React 19 + jsdom 29).
 */
function dispatchDrop(target: Element, files: File[]): void {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: { files },
  });
  target.dispatchEvent(event);
}

function getDropzone(container: HTMLElement): HTMLElement {
  const dropzone = container.querySelector<HTMLElement>(
    "[data-testid='image-upload-dropzone']",
  );
  if (!dropzone) {
    throw new Error("Expected the dropzone element to be rendered");
  }
  return dropzone;
}

describe("ImageUpload", () => {
  describe("static chrome (AC-05 helper text injected by parent)", () => {
    it("renders the Polish field label and dropzone hint from the i18n module", () => {
      render(<ImageUpload variant="complaint" />);

      expect(
        screen.getByText(pl.form.fields.image.label),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.image.dropzoneHint),
      ).toBeInTheDocument();
    });

    it("renders the COMPLAINT variant helper text and not the RETURN one", () => {
      render(<ImageUpload variant="complaint" />);

      expect(
        screen.getByText(pl.form.fields.image.helperText.complaint),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(pl.form.fields.image.helperText.return),
      ).not.toBeInTheDocument();
    });

    it("renders the RETURN variant helper text when variant='return'", () => {
      render(<ImageUpload variant="return" />);

      expect(
        screen.getByText(pl.form.fields.image.helperText.return),
      ).toBeInTheDocument();
    });

    it("restricts the native picker to the allowed MIME types via the accept attribute", () => {
      const { container } = render(<ImageUpload variant="complaint" />);
      const input = getFileInput(container);

      expect(input.accept).toBe("image/jpeg,image/png,image/webp");
    });

    it("starts with no preview, no remove button, and no error", () => {
      render(<ImageUpload variant="complaint" />);

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: pl.form.fields.image.removeButton,
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("format validation (AC-05)", () => {
    it("rejects a GIF with the Polish error that names every allowed format and the size limit", async () => {
      // applyAccept:false because a user can bypass the native picker's
      // accept filter (drag-drop, or "All files" in the OS dialog); the
      // component's JS validation is the real enforcement.
      const user = userEvent.setup({ applyAccept: false });
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="complaint" onFileChange={onFileChange} />,
      );
      const input = getFileInput(container);

      await user.upload(input, GIF_FIXTURE);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(VALIDATION_MESSAGES_PL.imageInvalid);
      // AC-05: the message itself must name JPG, PNG, WebP and the 10 MB cap.
      expect(alert.textContent ?? "").toMatch(/JPG/);
      expect(alert.textContent ?? "").toMatch(/PNG/);
      expect(alert.textContent ?? "").toMatch(/WebP/);
      expect(alert.textContent ?? "").toMatch(/10 MB/);

      // No preview rendered and parent is told there is no valid file.
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(onFileChange).toHaveBeenLastCalledWith(null);
      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });
  });

  describe("size validation (AC-05 boundary)", () => {
    it("rejects an 11 MB JPEG with the Polish size error", async () => {
      const user = userEvent.setup();
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="complaint" onFileChange={onFileChange} />,
      );
      const input = getFileInput(container);

      await user.upload(input, jpegOfMb(11));

      expect(screen.getByRole("alert")).toHaveTextContent(
        VALIDATION_MESSAGES_PL.imageInvalid,
      );
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(onFileChange).toHaveBeenLastCalledWith(null);
      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });

    it("accepts a JPEG whose size is exactly the 10 MB boundary", async () => {
      const user = userEvent.setup();
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="complaint" onFileChange={onFileChange} />,
      );
      const input = getFileInput(container);

      const boundary = new File(
        [new Uint8Array(MAX_IMAGE_SIZE_BYTES)],
        "dokladnie-10mb.jpg",
        { type: "image/jpeg" },
      );
      await user.upload(input, boundary);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(onFileChange).toHaveBeenLastCalledWith(boundary);
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("valid selection preview (AC-06)", () => {
    it("renders the thumbnail, file name, formatted size and remove button for a valid PNG", async () => {
      const user = userEvent.setup();
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="return" onFileChange={onFileChange} />,
      );
      const input = getFileInput(container);

      await user.upload(input, PNG_FIXTURE);

      const thumbnail = screen.getByRole("img");
      expect(thumbnail).toHaveAttribute("src", "blob:fake-preview-1");
      expect(thumbnail).toHaveAttribute("alt", PNG_FIXTURE.name);

      expect(screen.getByText(PNG_FIXTURE.name)).toBeInTheDocument();
      // Size is rendered with the Polish locale and a "B" unit suffix; we
      // only assert the byte count is shown, not a specific grouping char.
      expect(screen.getByText(/^64\s?B$/)).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: new RegExp(pl.form.fields.image.removeButton),
        }),
      ).toBeInTheDocument();

      expect(onFileChange).toHaveBeenLastCalledWith(PNG_FIXTURE);
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("remove + re-select (AC-06)", () => {
    it("clears the preview and revokes the object URL when the remove button is clicked, then allows re-selecting a file", async () => {
      const user = userEvent.setup();
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="complaint" onFileChange={onFileChange} />,
      );
      const input = getFileInput(container);

      await user.upload(input, PNG_FIXTURE);
      expect(screen.getByRole("img")).toBeInTheDocument();
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

      await user.click(
        screen.getByRole("button", {
          name: new RegExp(pl.form.fields.image.removeButton),
        }),
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onFileChange).toHaveBeenLastCalledWith(null);
      // AC-06: removing must release the blob URL.
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(
        "blob:fake-preview-1",
      );

      // Re-select works (the input value was reset so the same file fires
      // a change event again).
      await user.upload(input, JPG_FIXTURE);
      expect(screen.getByRole("img")).toHaveAttribute(
        "alt",
        JPG_FIXTURE.name,
      );
      expect(onFileChange).toHaveBeenLastCalledWith(JPG_FIXTURE);
    });

    it("replaces the previous preview (and revokes its URL) when a new valid file is chosen without an explicit remove", async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageUpload variant="complaint" />);
      const input = getFileInput(container);

      await user.upload(input, PNG_FIXTURE);
      const firstUrl = "blob:fake-preview-1";
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

      await user.upload(input, JPG_FIXTURE);

      expect(screen.getByRole("img")).toHaveAttribute(
        "alt",
        JPG_FIXTURE.name,
      );
      // Old preview URL was released during the swap.
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(firstUrl);
    });
  });

  describe("object URL lifecycle", () => {
    it("revokes the object URL when the component unmounts", async () => {
      const user = userEvent.setup();
      const { container, unmount } = render(
        <ImageUpload variant="complaint" />,
      );
      const input = getFileInput(container);

      await user.upload(input, PNG_FIXTURE);
      revokeObjectURLSpy.mockClear();

      unmount();

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(
        "blob:fake-preview-1",
      );
    });
  });

  describe("drag and drop", () => {
    it("accepts a valid file dropped onto the dropzone", async () => {
      const onFileChange = vi.fn();
      const { container } = render(
        <ImageUpload variant="complaint" onFileChange={onFileChange} />,
      );
      const dropzone = getDropzone(container);

      dispatchDrop(dropzone, [PNG_FIXTURE]);

      // findByRole (async) because a manually dispatched native event does
      // not flush React state synchronously the way userEvent does.
      const preview = await screen.findByRole("img");
      expect(preview).toHaveAttribute("alt", PNG_FIXTURE.name);
      expect(onFileChange).toHaveBeenLastCalledWith(PNG_FIXTURE);
    });

    it("rejects an oversized dropped file with the Polish error", async () => {
      const { container } = render(<ImageUpload variant="complaint" />);
      const dropzone = getDropzone(container);

      dispatchDrop(dropzone, [jpegOfMb(11)]);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(VALIDATION_MESSAGES_PL.imageInvalid);
    });
  });

  describe("error recovery", () => {
    it("clears a prior format error when a valid file is selected afterwards", async () => {
      // applyAccept:false so the GIF (rejected by the accept filter) still
      // reaches the JS validator the way a drag-dropped GIF would.
      const user = userEvent.setup({ applyAccept: false });
      const { container } = render(<ImageUpload variant="complaint" />);
      const input = getFileInput(container);

      await user.upload(input, GIF_FIXTURE);
      expect(screen.getByRole("alert")).toBeInTheDocument();

      await user.upload(input, PNG_FIXTURE);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      const preview = within(
        screen.getByRole("img").parentElement ?? document.body,
      );
      expect(preview.getByText(PNG_FIXTURE.name)).toBeInTheDocument();
    });
  });
});
