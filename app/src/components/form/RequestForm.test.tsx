import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { RequestForm } from "./RequestForm";
import {
  CATEGORY_LABELS,
  REASON_MAX_LENGTH,
  REQUEST_TYPE_LABELS,
  todayIsoDate,
} from "@/lib/validation";
import { pl } from "@/lib/i18n/pl";
import { VALIDATION_MESSAGES_PL } from "@/lib/validation/messages";

// jsdom v29 lacks pointer-capture + scrollIntoView, which radix Select / Popover
// and react-day-picker call during interaction. Scope these no-op polyfills to
// this file so they don't leak into the shared vitest.setup.ts (ADR-002 §8).
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

// Helper: open the request-type select and pick an option by its Polish label.
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

// Helper: open the date popover and click the day cell whose button text equals
// `dayNumber` and is currently enabled. Returns the clicked button.
async function clickCalendarDay(
  user: ReturnType<typeof userEvent.setup>,
  dayNumber: number,
): Promise<HTMLElement> {
  // The trigger button is labeled via aria-labelledby, so its accessible name is
  // the field label regardless of whether a date is already selected.
  await user.click(
    screen.getByRole("button", { name: pl.form.fields.purchaseDate.label }),
  );
  const matches = screen.getAllByText(String(dayNumber));
  const target = matches
    .map((el) => el.closest("button"))
    .find((b): b is HTMLElement => !!b && !b.disabled);
  if (!target) {
    throw new Error(`calendar day ${dayNumber} not found / not enabled`);
  }
  await user.click(target);
  return target;
}

describe("RequestForm", () => {
  describe("rendering (AC-01)", () => {
    it("renders every field label and the submit button in Polish", () => {
      render(<RequestForm onSubmit={() => {}} />);

      expect(
        screen.getByText(pl.form.fields.requestType.label),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.category.label),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.productName.label),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.purchaseDate.label),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.reason.labelOptional),
      ).toBeInTheDocument();
      expect(
        screen.getByText(pl.form.fields.image.label),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: pl.form.submitButton }),
      ).toBeInTheDocument();
    });

    it("renders the Polish placeholders for the free-text inputs and the date trigger", () => {
      render(<RequestForm onSubmit={() => {}} />);
      // Product name + reason are real inputs with placeholder attributes.
      expect(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(pl.form.fields.reason.placeholder),
      ).toBeInTheDocument();
      // The date field renders a button (not an input); its placeholder text is
      // shown as visible content until a date is selected.
      expect(
        screen.getByText(pl.form.fields.purchaseDate.placeholder),
      ).toBeInTheDocument();
    });

    it("renders a default placeholder area in the image slot when none is provided", () => {
      render(<RequestForm onSubmit={() => {}} />);
      // The image area is labelled and present even before T4.2 wiring.
      expect(
        screen.getByText(pl.form.fields.image.label),
      ).toBeInTheDocument();
    });

    it("renders a provided imageSlot node (contract for T4.3 wiring)", () => {
      render(
        <RequestForm
          onSubmit={() => {}}
          imageSlot={<div data-testid="injected-upload">UPLOAD UI</div>}
        />,
      );
      expect(screen.getByTestId("injected-upload")).toBeInTheDocument();
    });
  });

  describe("required-field validation on empty submit (AC-02)", () => {
    it("shows a field-level Polish error under every required field except reason", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<RequestForm onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.requestTypeRequired),
      ).toBeInTheDocument();
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.categoryRequired),
      ).toBeInTheDocument();
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.productNameRequired),
      ).toBeInTheDocument();
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.purchaseDateRequired),
      ).toBeInTheDocument();
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.imageRequired),
      ).toBeInTheDocument();
      // Reason is NOT required until request type = complaint, so no reason
      // error appears on an untouched form (AC-03).
      expect(
        screen.queryByText(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint),
      ).not.toBeInTheDocument();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("moves focus to the first invalid field (request-type select)", async () => {
      const user = userEvent.setup();
      render(<RequestForm onSubmit={() => {}} />);

      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      const trigger = screen.getByRole("combobox", {
        name: pl.form.fields.requestType.label,
      });
      expect(trigger).toHaveFocus();
    });

    it("does not call onSubmit while any field is invalid", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<RequestForm onSubmit={onSubmit} />);

      // Fill everything except the image (image is a prop in T4.1, undefined here).
      await pickRequestType(user, REQUEST_TYPE_LABELS.return);
      await pickCategory(user, CATEGORY_LABELS.smartphone);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "Smartfon Samsung Galaxy S23",
      );
      await clickCalendarDay(user, new Date().getDate());

      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.imageRequired),
      ).toBeInTheDocument();
    });
  });

  describe("reason required marker toggles with request type (AC-03)", () => {
    it("shows the optional label by default and switches to required when complaint is selected", async () => {
      const user = userEvent.setup();
      render(<RequestForm onSubmit={() => {}} />);

      expect(
        screen.getByText(pl.form.fields.reason.labelOptional),
      ).toBeInTheDocument();

      await pickRequestType(user, pl.form.fields.requestType.options.complaint);

      expect(
        screen.getByText(pl.form.fields.reason.labelRequired),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(pl.form.fields.reason.labelOptional),
      ).not.toBeInTheDocument();
    });

    it("switches back to optional when return is selected", async () => {
      const user = userEvent.setup();
      render(<RequestForm onSubmit={() => {}} />);

      await pickRequestType(user, pl.form.fields.requestType.options.complaint);
      await pickRequestType(user, pl.form.fields.requestType.options.return);

      expect(
        screen.getByText(pl.form.fields.reason.labelOptional),
      ).toBeInTheDocument();
    });

    it("clears a stale reason-required error immediately on switch to return", async () => {
      const user = userEvent.setup();
      render(
        <RequestForm
          onSubmit={() => {}}
          imageValue={{ type: "image/jpeg", size: 1024 }}
        />,
      );

      // Fill every sibling field validly so the shared schema's complaint-reason
      // cross-field check fires on submit (it only runs once siblings parse).
      await pickCategory(user, CATEGORY_LABELS.laptop);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "MacBook Air 13",
      );
      await clickCalendarDay(user, new Date().getDate());
      await pickRequestType(user, pl.form.fields.requestType.options.complaint);

      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint),
      ).toBeInTheDocument();

      // Switch to return -> the reason error must vanish instantly (AC-03).
      await pickRequestType(user, pl.form.fields.requestType.options.return);
      expect(
        screen.queryByText(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint),
      ).not.toBeInTheDocument();
    });
  });

  describe("reason character counter and cap (PRD §8)", () => {
    it("shows the counter starting at 0/max and updates as the user types", async () => {
      const user = userEvent.setup();
      render(<RequestForm onSubmit={() => {}} />);

      const counter0 = screen.getByText(`0/${REASON_MAX_LENGTH}`);
      // Polish screen-reader text per pl.common.characterCounterAriaLabel.
      expect(counter0).toHaveAttribute(
        "aria-label",
        pl.common.characterCounterAriaLabel(0, REASON_MAX_LENGTH),
      );

      const reason = screen.getByPlaceholderText(
        pl.form.fields.reason.placeholder,
      ) as HTMLTextAreaElement;
      await user.type(reason, "abc");

      expect(screen.getByText(`3/${REASON_MAX_LENGTH}`)).toBeInTheDocument();
    });

    it("caps input at REASON_MAX_LENGTH characters (paste/overflow is truncated)", () => {
      render(<RequestForm onSubmit={() => {}} />);
      const reason = screen.getByPlaceholderText(
        pl.form.fields.reason.placeholder,
      ) as HTMLTextAreaElement;

      fireEvent.change(reason, { target: { value: "a".repeat(REASON_MAX_LENGTH + 5) } });

      expect(reason.value.length).toBe(REASON_MAX_LENGTH);
      expect(
        screen.getByText(`${REASON_MAX_LENGTH}/${REASON_MAX_LENGTH}`),
      ).toBeInTheDocument();
    });
  });

  describe("purchase date picker (AC-04)", () => {
    it("disables future dates in the calendar (tomorrow)", async () => {
      const user = userEvent.setup();
      render(<RequestForm onSubmit={() => {}} />);

      await user.click(
        screen.getByRole("button", { name: pl.form.fields.purchaseDate.label }),
      );

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const candidates = screen.getAllByText(String(tomorrow.getDate()));
      const tomButton = candidates
        .map((el) => el.closest("button"))
        .filter((b): b is HTMLElement => !!b);
      // The tomorrow cell must exist and be disabled.
      expect(tomButton.some((b) => b.disabled)).toBe(true);
    });

    it("accepts today's date as a valid selection", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
        <RequestForm
          onSubmit={onSubmit}
          imageValue={{ type: "image/jpeg", size: 1024 }}
        />,
      );

      await pickRequestType(user, pl.form.fields.requestType.options.return);
      await pickCategory(user, CATEGORY_LABELS.laptop);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "MacBook Air 13",
      );
      await clickCalendarDay(user, new Date().getDate());
      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0].purchaseDate).toBe(todayIsoDate());
    });
  });

  describe("product name validation (PRD §8)", () => {
    it("shows the length error for a single-character product name", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
        <RequestForm
          onSubmit={onSubmit}
          imageValue={{ type: "image/jpeg", size: 1024 }}
        />,
      );

      await pickRequestType(user, pl.form.fields.requestType.options.return);
      await pickCategory(user, CATEGORY_LABELS.laptop);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "A",
      );
      await clickCalendarDay(user, new Date().getDate());
      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.productNameLength),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("successful submission (AC-02 happy path)", () => {
    it("calls onSubmit once with the validated Polish form values", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
        <RequestForm
          onSubmit={onSubmit}
          imageValue={{ type: "image/png", size: 2048 }}
        />,
      );

      await pickRequestType(user, pl.form.fields.requestType.options.complaint);
      await pickCategory(user, CATEGORY_LABELS.smartphone);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "iPhone 15",
      );
      await clickCalendarDay(user, new Date().getDate());
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.reason.placeholder),
        "Pękła obudowa po upadku.",
      );

      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        requestType: "complaint",
        category: "smartphone",
        productName: "iPhone 15",
        purchaseDate: todayIsoDate(),
        reason: "Pękła obudowa po upadku.",
      });
    });

    it("clears all field errors once the form becomes valid", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(
        <RequestForm
          onSubmit={onSubmit}
          imageValue={{ type: "image/jpeg", size: 1024 }}
        />,
      );

      // Trigger all errors first.
      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));
      expect(
        screen.getByText(VALIDATION_MESSAGES_PL.requestTypeRequired),
      ).toBeInTheDocument();

      // Now fix every field.
      await pickRequestType(user, pl.form.fields.requestType.options.return);
      await pickCategory(user, CATEGORY_LABELS.laptop);
      await user.type(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
        "MacBook Air 13",
      );
      await clickCalendarDay(user, new Date().getDate());
      await user.click(screen.getByRole("button", { name: pl.form.submitButton }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText(VALIDATION_MESSAGES_PL.requestTypeRequired),
      ).not.toBeInTheDocument();
    });
  });

  describe("disabled prop (AC-07 wiring contract)", () => {
    it("disables the submit button and free-text inputs when disabled", () => {
      render(<RequestForm onSubmit={() => {}} disabled />);
      expect(
        screen.getByRole("button", { name: pl.form.submitButton }),
      ).toBeDisabled();
      expect(
        screen.getByPlaceholderText(pl.form.fields.productName.placeholder),
      ).toBeDisabled();
      expect(
        screen.getByPlaceholderText(pl.form.fields.reason.placeholder),
      ).toBeDisabled();
    });
  });
});
