import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

function platformModifier() {
  if (typeof navigator === "undefined") return "Ctrl/Cmd";
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "Cmd" : "Ctrl";
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const modifier = platformModifier();

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);
  const shortcuts = useMemo(
    () =>
      [
        [t("editor.tool.select"), "V"],
        [t("editor.tool.hand"), "H · Space drag"],
        [t("editor.tool.text"), "T"],
        [t("editor.tool.shape"), "R"],
        [t("editor.tool.asset"), "I"],
        [t("editor.undo"), "Mod+Z"],
        [t("editor.redo"), "Shift+Mod+Z · Ctrl+Y"],
        [t("editor.copy"), "Mod+D"],
        [t("editor.shortcuts.delete"), "Delete · Backspace"],
        [t("editor.group"), "Mod+G"],
        [t("editor.ungroup"), "Shift+Mod+G"],
        [t("editor.fit"), "Mod+0"],
        [t("editor.shortcuts.view100"), "Mod+1"],
        [t("editor.shortcuts.zoom"), "+ / -"],
        [t("editor.shortcuts.nudge"), "Arrow · Shift+Arrow"],
        [t("editor.shortcuts.disableSnap"), "Hold Alt/Option"],
        [t("editor.shortcuts.cancel"), "Escape"],
      ] as const,
    [t],
  );
  const rows = useMemo(
    () =>
      shortcuts.filter(([label, shortcut]) =>
        `${label} ${shortcut}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, shortcuts],
  );
  if (!open) return null;
  return (
    <div className="editor-dialog-backdrop">
      <button
        type="button"
        className="editor-dialog-backdrop__dismiss"
        aria-label={t("editor.close")}
        onClick={onClose}
      />
      <section
        className="editor-shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-shortcuts-title"
      >
        <header className="editor-shortcuts-dialog__header">
          <div>
            <p className="panel-kicker">{t("editor.keyboard")}</p>
            <h2 id="editor-shortcuts-title">{t("editor.shortcuts")}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("editor.close")}
          </Button>
        </header>
        <input
          ref={searchRef}
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("editor.shortcutsSearch")}
        />
        <div className="editor-shortcuts-list">
          {rows.map(([label, shortcut]) => (
            <div key={label}>
              <span>{label}</span>
              <kbd>{shortcut.replaceAll("Mod", modifier)}</kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
