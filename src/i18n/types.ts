import type { enMessages } from "@/i18n/messages/en";

export type Locale = "en" | "ar";
export type UiDirection = "ltr" | "rtl";
export type MessageKey = keyof typeof enMessages;
export type MessageCatalog = Record<MessageKey, string>;
export type MessageVariables = Readonly<Record<string, string | number>>;
