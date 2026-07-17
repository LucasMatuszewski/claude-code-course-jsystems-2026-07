import Image from "next/image";
import Link from "next/link";

// PRD §9.1: application title + one-sentence explainer shown on the app
// shell (persists across screens, e.g. request form and chat).
const APP_TITLE = "Zwroty i reklamacje — wstępna decyzja online";
const APP_EXPLAINER =
  "Prześlij zgłoszenie ze zdjęciem produktu, a asystent AI przygotuje dla Ciebie wstępną decyzję w kilka chwil.";

export function AppHeader() {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center px-6 py-3">
        <Link
          href="/"
          aria-label="Strona główna"
          className="flex items-center"
        >
          <Image
            src="/logo.svg"
            alt="Play"
            width={100}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-6">
        <h1 className="text-xl font-medium text-foreground">{APP_TITLE}</h1>
        <p className="mt-2 text-sm text-text-secondary">{APP_EXPLAINER}</p>
      </div>
    </header>
  );
}
