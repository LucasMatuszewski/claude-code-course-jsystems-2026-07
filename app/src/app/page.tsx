"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ErrorBanner } from "@/components/form/ErrorBanner";
import { ImageUpload } from "@/components/form/ImageUpload";
import { RequestForm } from "@/components/form/RequestForm";
import type { RequestFormValues } from "@/components/form/RequestForm";
import { useSubmission } from "@/components/form/useSubmission";
import { pl } from "@/lib/i18n/pl";
import type { ImageFileMeta } from "@/lib/validation";

/**
 * Home (PRD 9.1, ADR-002 3)
 * ----------------
 * Single centered column hosting the application title (`pl.app.name`), a
 * one-sentence explainer (`pl.form.description`), and the request form with
 * the image upload wired through the submission state machine.
 *
 * The Play-brand header (logo + marketing title) is rendered by the root
 * layout's AppHeader (task T1.5) - it is NOT duplicated here. This page only
 * owns the form chrome, the busy status text, the failure banner, and the
 * `done -> router.push("/chat/:id")` handoff (ADR-002 D2-02).
 *
 * Image ownership lives in this page (T4.3): the page holds the selected
 * `File`, feeds its `{type, size}` metadata into `RequestForm.imageValue`
 * (which the shared Zod schema uses to gate submit on AC-05), and renders
 * `<ImageUpload/>` into `RequestForm.imageSlot`. The submission machine
 * receives both the validated values and the raw file on submit.
 *
 * NOTE on `ImageUpload.variant`: the variant drives the Polish helper text
 * under the dropzone (complaint vs. return). The form's request-type field is
 * internal to `RequestForm` (owned by T4.1) and is not lifted to the parent,
 * so this page cannot observe live request-type changes. The variant is
 * defaulted to "return" (matches the demo fixture `clean-product.jpg`); the
 * helper text not dynamically tracking a mid-session toggle is a known minor
 * UX limitation that does not affect validation or any AC.
 */
export default function Home() {
  const router = useRouter();
  const { state, statusText, submit, retry } = useSubmission();

  const [imageFile, setImageFile] = React.useState<File | null>(null);

  // Drive navigation when the machine reaches `done`. The hook stays free of
  // Next-router concerns; the page owns the routing side-effect (ADR-002 3).
  React.useEffect(() => {
    if (state.status === "done") {
      router.push(`/chat/${state.sessionId}`);
    }
  }, [state, router]);

  const handleFileChange = React.useCallback((file: File | null) => {
    setImageFile(file);
  }, []);

  const handleSubmit = React.useCallback(
    (values: RequestFormValues) => {
      if (imageFile === null) {
        // RequestForm's onSubmit only fires when the shared schema - which
        // includes `imageValue` - validates, so this is unreachable in normal
        // flow. Kept as a defensive guard for type-narrowing.
        return;
      }
      void submit(values, imageFile);
    },
    [imageFile, submit],
  );

  const imageValue: ImageFileMeta | undefined = React.useMemo(
    () =>
      imageFile === null
        ? undefined
        : { type: imageFile.type, size: imageFile.size },
    [imageFile],
  );

  const isBusy = state.status === "creating" || state.status === "analyzing";

  return (
    // NOTE: intentionally NOT `max-w-xl` - globals.css defines a custom
    // Play spacing scale (`--spacing-xl: 24px` etc., see "@theme" block) that
    // Tailwind v4 resolves size utilities against, so the built-in
    // `max-w-{xs,sm,md,lg,xl,2xl}` classes collapse to that tiny spacing
    // value instead of the standard container width. Using an explicit
    // value here (equivalent to Tailwind's default max-w-xl = 36rem) avoids
    // the collision without touching the frozen globals.css scope.
    <div className="mx-auto flex w-full max-w-[36rem] flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          {pl.app.name}
        </h2>
        <p className="text-sm text-text-secondary">{pl.form.description}</p>
      </header>

      {state.status === "failed" && (
        <ErrorBanner state={state} onRetry={() => void retry()} />
      )}

      <RequestForm
        onSubmit={handleSubmit}
        imageValue={imageValue}
        disabled={isBusy}
        imageSlot={
          <ImageUpload variant="return" onFileChange={handleFileChange} />
        }
      />

      {statusText !== undefined && (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-sm font-medium text-text-secondary"
        >
          {statusText}
        </p>
      )}
    </div>
  );
}
