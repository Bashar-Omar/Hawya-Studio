import { Command, CornerDownLeft, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { appCommandDefinitions, type AppCommandId } from "@/app/commands/command-registry";
import { useUiPreferences } from "@/app/providers/ui-preferences";
import { appRoutes } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { useAnnounce } from "@/components/app/LiveRegion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import type { ThemePreference } from "@/infrastructure/preferences/browser-preference-store";

const themeSequence: readonly ThemePreference[] = ["system", "light", "dark"];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const { locale, setLocale, setTheme, theme } = useUiPreferences();
  const { t } = useI18n();
  const announce = useAnnounce();

  const executeCommand = useCallback(
    (commandId: AppCommandId) => {
      switch (commandId) {
        case "navigate.landing":
          navigate(appRoutes.landing);
          break;
        case "navigate.studio":
          navigate(appRoutes.studio);
          break;
        case "navigate.settings":
          navigate(appRoutes.settings);
          break;
        case "navigate.about":
          navigate(appRoutes.about);
          break;
        case "preferences.toggle-language": {
          const nextLocale = locale === "en" ? "ar" : "en";
          setLocale(nextLocale);
          announce(
            t("language.changed", { language: nextLocale === "ar" ? "العربية" : "English" }),
          );
          break;
        }
        case "preferences.cycle-theme": {
          const currentIndex = themeSequence.indexOf(theme);
          const nextTheme = themeSequence[(currentIndex + 1) % themeSequence.length] ?? "system";
          setTheme(nextTheme);
          const themeLabel =
            nextTheme === "system"
              ? t("settings.theme.system")
              : nextTheme === "light"
                ? t("settings.theme.light")
                : t("settings.theme.dark");
          announce(t("theme.changed", { theme: themeLabel }));
          break;
        }
      }
      setOpen(false);
      setQuery("");
    },
    [announce, locale, navigate, setLocale, setTheme, t, theme],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        navigate(appRoutes.settings);
        setOpen(false);
        return;
      }

      if (!isEditable && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const commands = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "ar" ? "ar" : "en");
    return appCommandDefinitions.filter((command) => {
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [t(command.labelKey), ...command.searchTerms].join(" ").toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [locale, query, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button className="command-trigger" variant="ghost" size="sm">
            <Command aria-hidden="true" size={16} strokeWidth={1.8} />
            <span>{t("command.open")}</span>
            <kbd className="command-trigger__shortcut">⌘K</kbd>
          </Button>
        }
      />

      <DialogContent
        closeLabel={t("dialog.close")}
        className="command-dialog"
        initialFocus={inputRef}
      >
          <DialogTitle className="sr-only">{t("command.menu.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("command.menu.description")}</DialogDescription>
          <div className="command-search">
            <Search aria-hidden="true" size={18} strokeWidth={1.8} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("command.search")}
              aria-label={t("command.search")}
            />
          </div>
          <fieldset className="command-list">
            <legend className="sr-only">{t("command.menu.title")}</legend>
            {commands.length ? (
              commands.map((command) => (
                <button
                  className="command-item"
                  key={command.id}
                  onClick={() => executeCommand(command.id)}
                  type="button"
                >
                  <span>{t(command.labelKey)}</span>
                  <span className="command-item__meta">
                    {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                    <CornerDownLeft aria-hidden="true" size={14} />
                  </span>
                </button>
              ))
            ) : (
              <p className="command-empty">{t("command.empty")}</p>
            )}
          </fieldset>
        </DialogContent>
    </Dialog>
  );
}
