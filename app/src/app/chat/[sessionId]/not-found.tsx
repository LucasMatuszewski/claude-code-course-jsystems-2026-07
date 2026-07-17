import Link from "next/link";

import { pl } from "@/lib/i18n/pl";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {pl.chat.sessionNotFound.title}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {pl.chat.sessionNotFound.message}
      </p>
      <Link href="/" className="underline underline-offset-4">
        {pl.chat.sessionNotFound.backLink}
      </Link>
    </div>
  );
}
