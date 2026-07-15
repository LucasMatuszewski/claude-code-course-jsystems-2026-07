import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Nie znaleziono strony
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Strona, której szukasz, nie istnieje lub została przeniesiona.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Wróć na stronę główną
      </Link>
    </div>
  );
}
