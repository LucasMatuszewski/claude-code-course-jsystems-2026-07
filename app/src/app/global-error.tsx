"use client"; // Error boundaries must be Client Components

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    // global-error replaces the root layout, so it must include its own
    // <html> and <body> tags.
    <html lang="pl">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 p-16 text-center">
        <h2 className="text-2xl font-semibold">Coś poszło nie tak</h2>
        <p className="text-muted-foreground">
          Wystąpił nieoczekiwany błąd aplikacji.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md border px-4 py-2"
        >
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
