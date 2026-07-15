/**
 * Stable keys + Polish labels + functional limits for the request form,
 * chat, and image upload (PRD §8, ADR-000 §4/§5, ADR-003 schema note).
 *
 * Category/request-type values are persisted as these exact string keys
 * (ADR-003 `sessions.requestType` / `sessions.category` CHECK constraints).
 * Polish labels are kept separate so the UI can localize without touching
 * stored data or agent-facing values.
 */

export const REQUEST_TYPE_VALUES = ["complaint", "return"] as const;
export type RequestType = (typeof REQUEST_TYPE_VALUES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  complaint: "Reklamacja",
  return: "Zwrot",
};

// Order matches PRD §8: Smartphone / Laptop / Tablet / TV or monitor /
// Audio (headphones, speakers) / Small home appliance /
// Computer peripherals & accessories / Other.
export const CATEGORY_VALUES = [
  "smartphone",
  "laptop",
  "tablet",
  "tv_monitor",
  "audio",
  "small_appliance",
  "peripherals",
  "other",
] as const;
export type Category = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  smartphone: "Smartfon",
  laptop: "Laptop",
  tablet: "Tablet",
  tv_monitor: "Telewizor lub monitor",
  audio: "Audio (słuchawki, głośniki)",
  small_appliance: "Drobny sprzęt AGD",
  peripherals: "Peryferia i akcesoria komputerowe",
  other: "Inne",
};

export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_NAME_MAX_LENGTH = 100;
export const REASON_MAX_LENGTH = 2000;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
