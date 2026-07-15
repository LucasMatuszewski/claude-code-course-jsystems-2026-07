/**
 * Polish UI strings — single source of truth for all static, customer-facing
 * text rendered by the request form and chat screens (PRD §9.1, §9.2; AC-29).
 *
 * Scope: static UI chrome only — field labels, placeholders, helper texts,
 * buttons, staged progress/status texts, error banners, chat chrome, and
 * decision badge labels.
 *
 * Explicitly OUT of scope for this module (do not add here):
 * - Zod validation messages. The shared client/server error map lives in
 *   `lib/validation` (task T1.1) so client and server emit byte-identical
 *   wording (ADR-002 §3 "Polish text handling", TAC-002-01). Duplicating
 *   them here would create a second source of truth that can drift.
 * - The AI-generated decision/justification prose itself (greeting,
 *   justification paragraphs, numbered next steps, disclaimer sentence).
 *   That text is produced live by the decision agent per request (PRD §11)
 *   — this module only supplies the static chrome *around* it (e.g. the
 *   decision category badge label, the "decision changed" marker).
 *
 * No i18n framework is used by design — Polish is the only supported
 * language for the MVP (PRD §7 "Out of Scope" — Multilingual support).
 */

const decisionBadge = {
  APPROVE: "Zaakceptowano",
  REJECT: "Odrzucono",
  MORE_INFO: "Wymagane informacje",
  ESCALATE: "Eskalacja",
} as const;

export const pl = {
  /** Application identity, reused on the form page heading and the chat header (PRD §9.1, §9.2). */
  app: {
    name: "Asystent decyzji serwisowych",
  },

  /** Screen 9.1 — request form. */
  form: {
    description:
      "Wypełnij formularz i dołącz zdjęcie sprzętu — sztuczna inteligencja szybko oceni Twoje zgłoszenie, a ostateczną decyzję potwierdzi nasz pracownik.",
    fields: {
      requestType: {
        label: "Rodzaj zgłoszenia",
        options: {
          complaint: "Reklamacja",
          return: "Zwrot",
        },
      },
      category: {
        label: "Kategoria sprzętu",
        placeholder: "Wybierz kategorię sprzętu",
      },
      productName: {
        label: "Nazwa / model produktu",
        placeholder: "np. Smartfon Samsung Galaxy S23",
      },
      purchaseDate: {
        label: "Data zakupu",
        placeholder: "Wybierz datę zakupu",
      },
      reason: {
        // Required marker toggles immediately with request type (AC-03) —
        // the component picks one of these two full labels, no client-side
        // string concatenation needed.
        labelRequired: "Powód zgłoszenia (wymagane)",
        labelOptional: "Powód zgłoszenia (opcjonalnie)",
        placeholder: "Opisz szczegóły swojego zgłoszenia…",
      },
      image: {
        label: "Zdjęcie sprzętu",
        dropzoneHint:
          "Przeciągnij i upuść zdjęcie tutaj lub kliknij, aby wybrać plik",
        // Separate helper text per request type (PRD §9.1: "helper text
        // under the image field" changes with the selected request type).
        helperText: {
          complaint: "Dodaj zdjęcie pokazujące uszkodzenie sprzętu.",
          return: "Dodaj zdjęcie pokazujące stan produktu.",
        },
        removeButton: "Usuń zdjęcie",
        changeButton: "Zmień zdjęcie",
      },
    },
    submitButton: "Wyślij zgłoszenie",
  },

  /** Staged progress texts shown on the submit button while busy (PRD §9.1 loading state, ADR-002 D2-02). */
  submission: {
    stages: {
      uploading: "Wysyłanie zdjęcia…",
      analyzing: "Analizuję zdjęcie…",
      preparingDecision: "Przygotowuję decyzję…",
    },
  },

  /** Form failure banner — two variants per PRD §9.1 failure state / §4.5. */
  errorBanner: {
    retry: {
      message: "Nie udało się przeanalizować zgłoszenia.",
      retryButton: "Spróbuj ponownie",
      sessionIdLabel: "Numer zgłoszenia",
    },
    unavailable: {
      message:
        "Usługa jest chwilowo niedostępna. Zgłoszenie zostało zapisane pod poniższym numerem — spróbuj ponownie za chwilę.",
      sessionIdLabel: "Numer zgłoszenia",
    },
  },

  /** Screen 9.2 — chat. */
  chat: {
    header: {
      sessionIdLabel: "Numer zgłoszenia",
      newRequestLink: "Nowe zgłoszenie",
    },
    input: {
      placeholder: "Napisz wiadomość…",
      sendButton: "Wyślij",
    },
    typingIndicatorLabel: "Asystent pisze…",
    retryButton: "Spróbuj ponownie",
    sessionNotFound: {
      title: "Nie znaleziono zgłoszenia",
      message:
        "Zgłoszenie o podanym numerze nie istnieje lub zostało usunięte.",
      backLink: "Wróć do formularza",
    },
    decisionBadge,
    decisionChanged: {
      badgeLabel: "Decyzja zmieniona",
      fromLabel: "Poprzednia decyzja",
      toLabel: "Nowa decyzja",
      arrow: "→",
    },
  },

  /** Shared, cross-cutting strings. */
  common: {
    /**
     * Accessible label for character-counter widgets (reason textarea, chat
     * input — both max 2000 chars). The visible counter itself is a plain
     * "current/max" number pair rendered by the component; this is the
     * Polish screen-reader text for it, e.g. "150 z 2000 znaków".
     */
    characterCounterAriaLabel: (current: number, max: number): string =>
      `${current} z ${max} znaków`,
  },
} as const;

export type Pl = typeof pl;
export type DecisionCategory = keyof typeof decisionBadge;
