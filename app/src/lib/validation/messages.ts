import { MAX_IMAGE_SIZE_MB, PRODUCT_NAME_MAX_LENGTH, PRODUCT_NAME_MIN_LENGTH, REASON_MAX_LENGTH, CHAT_MESSAGE_MAX_LENGTH } from "./constants";

/**
 * The single source of truth for every Polish validation message used by
 * both the client form and the server-side route handlers (AC-29,
 * ADR-002 §"Polish text handling", TAC-002-01). Importing schemas from
 * `./schemas` (which reference these constants) guarantees client and
 * server reject the same input with byte-identical wording.
 */
export const VALIDATION_MESSAGES_PL = {
  requestTypeRequired: "Wybierz rodzaj zgłoszenia (Reklamacja lub Zwrot).",
  categoryRequired: "Wybierz kategorię sprzętu.",
  productNameRequired: "Podaj nazwę lub model produktu.",
  productNameLength: `Nazwa produktu musi mieć od ${PRODUCT_NAME_MIN_LENGTH} do ${PRODUCT_NAME_MAX_LENGTH} znaków.`,
  purchaseDateRequired: "Podaj datę zakupu.",
  purchaseDateInvalid: "Podaj prawidłową datę zakupu.",
  purchaseDateFuture: "Data zakupu nie może być datą przyszłą.",
  reasonRequiredForComplaint: "Opis usterki jest wymagany dla reklamacji.",
  reasonTooLong: `Opis może mieć maksymalnie ${REASON_MAX_LENGTH} znaków.`,
  imageRequired: "Dodaj zdjęcie sprzętu.",
  imageInvalid: `Akceptowane są tylko pliki JPG, PNG lub WebP o rozmiarze maksymalnie ${MAX_IMAGE_SIZE_MB} MB.`,
  chatMessageRequired: "Wiadomość nie może być pusta.",
  chatMessageTooLong: `Wiadomość może mieć maksymalnie ${CHAT_MESSAGE_MAX_LENGTH} znaków.`,
} as const;

export type ValidationMessageKey = keyof typeof VALIDATION_MESSAGES_PL;
