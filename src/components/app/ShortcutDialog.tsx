import { Keyboard } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutDialog({ onOpenChange, open }: ShortcutDialogProps) {
  const { t } = useI18n();

  const shortcuts = [
    { label: t("shortcuts.commands"), keys: ["Ctrl/Cmd", "K"] },
    { label: t("shortcuts.settings"), keys: ["Ctrl/Cmd", ","] },
    { label: t("shortcuts.closeDialog"), keys: ["Esc"] },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("dialog.close")} className="shortcut-dialog">
        <div className="dialog-heading">
          <div className="dialog-icon" aria-hidden="true">
            <Keyboard size={20} strokeWidth={1.8} />
          </div>
          <div>
            <DialogTitle className="dialog-title">{t("shortcuts.title")}</DialogTitle>
            <DialogDescription className="dialog-description">
              {t("shortcuts.description")}
            </DialogDescription>
          </div>
        </div>
        <div className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <div className="shortcut-row" key={shortcut.label}>
              <span>{shortcut.label}</span>
              <span className="shortcut-keys">
                <span className="sr-only">{shortcut.keys.join(" + ")}</span>
                <span aria-hidden="true">
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
