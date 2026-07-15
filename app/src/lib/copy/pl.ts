/**
 * Single source of truth for every user-facing Polish string in the app
 * (AC-50, ADR-004 §3 "Shared Polish copy"). Both client and server code
 * import this module read-only — never inline a literal UI string
 * elsewhere (TAC-004-01).
 *
 * Organized by screen: form (PRD §9.1), chat (PRD §9.2, §11), reviewer
 * (PRD §9.3), and shared/errors used across screens.
 */

export const pl = {
  form: {
    title: "Zgłoś zwrot lub reklamację",
    subtitle:
      "Prześlij zdjęcie sprzętu i wypełnij krótki formularz — decyzję otrzymasz od razu na czacie.",
    fields: {
      requestType: {
        label: "Rodzaj zgłoszenia",
        options: {
          zwrot: "Zwrot",
          reklamacja: "Reklamacja",
        },
      },
      category: {
        label: "Kategoria sprzętu",
        options: {
          Smartfon: "Smartfon",
          Laptop: "Laptop",
          Tablet: "Tablet",
          Telewizor: "Telewizor",
          Słuchawki: "Słuchawki",
          Monitor: "Monitor",
          Inne: "Inne",
        },
      },
      productName: {
        label: "Nazwa / model produktu",
        placeholder: "np. Słuchawki Sony WH-1000XM5",
      },
      purchaseDate: {
        label: "Data zakupu",
        helper: "Data zakupu nie może być późniejsza niż dzisiaj.",
      },
      description: {
        labelRequired: "Opis wady (wymagane)",
        labelOptional: "Opis (opcjonalnie)",
        helperReturn: "Możesz krótko opisać powód zwrotu.",
        helperComplaint: "Opisz wadę produktu oraz okoliczności jej wystąpienia.",
      },
      image: {
        label: "Zdjęcie sprzętu",
        dropzoneText: "Przeciągnij i upuść zdjęcie tutaj lub",
        pickButton: "Wybierz plik",
        helper: "Akceptowane formaty: JPG, PNG, WebP. Maksymalny rozmiar: 10 MB.",
        removeButton: "Usuń zdjęcie",
      },
    },
    submitButton: "Wyślij zgłoszenie",
    loadingText: "Analizujemy Twoje zgłoszenie…",
    errors: {
      requestTypeRequired: "Wybierz rodzaj zgłoszenia.",
      categoryRequired: "Wybierz kategorię sprzętu.",
      productNameRequired: "Podaj nazwę lub model produktu.",
      purchaseDateInvalid: "Podaj prawidłową datę zakupu.",
      purchaseDateFuture: "Data zakupu nie może być datą przyszłą.",
      descriptionRequiredForComplaint: "Opisz wadę produktu — to pole jest wymagane dla reklamacji.",
      imageRequired: "Dodaj zdjęcie sprzętu.",
      imageInvalidType: "Nieobsługiwany format pliku. Dozwolone formaty: JPG, PNG, WebP.",
      imageTooLarge: "Plik jest za duży. Maksymalny rozmiar to 10 MB.",
    },
    serviceError: {
      message: "Przepraszamy, analiza jest chwilowo niedostępna…",
      retryButton: "Spróbuj ponownie",
    },
  },
  chat: {
    caseSummary: {
      caseNumberLabel: "Numer zgłoszenia",
      requestTypeLabel: "Rodzaj zgłoszenia",
      productNameLabel: "Produkt",
    },
    greeting: {
      salutation: "Cześć!",
      intro: "Twoje zgłoszenie zostało przeanalizowane.",
      decisionHeading: "Decyzja",
      justificationHeading: "Uzasadnienie",
      nextStepsHeading: "Kolejne kroki",
    },
    decisionLabels: {
      zaakceptowane: "Zaakceptowane",
      odrzucone: "Odrzucone",
      doWeryfikacji: "Do weryfikacji przez pracownika",
    },
    updatedDecisionLabel: "Zaktualizowana decyzja",
    disclaimer:
      "Ta decyzja została wygenerowana automatycznie i może zostać zweryfikowana przez pracownika serwisu.",
    offTopicRedirect:
      "Mogę pomóc wyłącznie w sprawach dotyczących Twojego zgłoszenia — wróćmy do Twojej sprawy.",
    typingIndicator: "Agent pisze…",
    inputPlaceholder: "Napisz wiadomość…",
    reupload: {
      prompt: "Prześlij jedno lepsze zdjęcie sprzętu.",
      helper: "Akceptowane formaty: JPG, PNG, WebP. Maksymalny rozmiar: 10 MB.",
    },
    streamError: {
      message: "Nie udało się wysłać wiadomości.",
      retryButton: "Spróbuj ponownie",
    },
    newCase: {
      buttonLabel: "Nowe zgłoszenie",
      confirmMessage:
        "Czy na pewno chcesz rozpocząć nowe zgłoszenie? Bieżąca rozmowa zostanie utracona.",
    },
    escalationNotice: "Zapisz numer zgłoszenia — pracownik serwisu zweryfikuje Twoją sprawę.",
  },
  reviewer: {
    listTitle: "Zgłoszenia do weryfikacji",
    columns: {
      caseNumber: "Numer zgłoszenia",
      createdAt: "Data i godzina",
      requestType: "Rodzaj zgłoszenia",
      category: "Kategoria",
      productName: "Produkt",
    },
    emptyState: "Brak zgłoszeń do weryfikacji",
    backButton: "Wróć do listy",
    detail: {
      formDataHeading: "Dane zgłoszenia",
      imageHeading: "Zdjęcie",
      analysisHeading: "Analiza obrazu",
      decisionHistoryHeading: "Historia decyzji",
      transcriptHeading: "Historia rozmowy",
    },
  },
  errors: {
    caseNotFound: "Nie znaleziono zgłoszenia o podanym numerze.",
    genericApi: "Wystąpił błąd. Spróbuj ponownie później.",
  },
} as const;

export type Pl = typeof pl;
