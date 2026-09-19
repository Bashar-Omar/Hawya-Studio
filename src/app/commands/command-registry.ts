import type { MessageKey } from "@/i18n/types";

export type AppCommandId =
  | "project.create"
  | "navigate.landing"
  | "navigate.studio"
  | "navigate.settings"
  | "navigate.about"
  | "preferences.toggle-language"
  | "preferences.cycle-theme";

export interface AppCommandDefinition {
  id: AppCommandId;
  labelKey: MessageKey;
  shortcut?: string;
  searchTerms: readonly string[];
}

export const appCommandDefinitions: readonly AppCommandDefinition[] = [
  {
    id: "project.create",
    labelKey: "command.createProject",
    searchTerms: ["new project", "create project", "brand", "مشروع جديد", "إنشاء مشروع"],
  },
  {
    id: "navigate.studio",
    labelKey: "command.navigateStudio",
    shortcut: "G S",
    searchTerms: ["studio", "projects", "home", "الاستديو", "المشروعات"],
  },
  {
    id: "navigate.settings",
    labelKey: "command.navigateSettings",
    shortcut: "Ctrl/Cmd ,",
    searchTerms: ["settings", "preferences", "theme", "language", "الإعدادات", "المظهر", "اللغة"],
  },
  {
    id: "navigate.about",
    labelKey: "command.navigateAbout",
    searchTerms: ["about", "open source", "license", "حول", "المصدر", "الرخصة"],
  },
  {
    id: "navigate.landing",
    labelKey: "command.navigateLanding",
    searchTerms: ["landing", "home", "website", "الرئيسية"],
  },
  {
    id: "preferences.toggle-language",
    labelKey: "command.toggleLanguage",
    searchTerms: ["language", "arabic", "english", "rtl", "ltr", "لغة", "العربية", "الإنجليزية"],
  },
  {
    id: "preferences.cycle-theme",
    labelKey: "command.cycleTheme",
    searchTerms: ["theme", "appearance", "dark", "light", "system", "المظهر", "داكن", "فاتح"],
  },
];
