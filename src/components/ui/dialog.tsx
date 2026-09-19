import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { joinClassNames } from "@/shared/ui/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Popup> {
  children: ReactNode;
  closeLabel: string;
  showCloseButton?: boolean;
}

export function DialogContent({
  children,
  className,
  closeLabel,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const popupClassName: ComponentProps<typeof DialogPrimitive.Popup>["className"] =
    typeof className === "function"
      ? (state) => joinClassNames("dialog-popup", className(state))
      : joinClassNames("dialog-popup", className);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="dialog-backdrop" />
      <DialogPrimitive.Viewport className="dialog-viewport">
        <DialogPrimitive.Popup className={popupClassName} {...props}>
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              className="dialog-close"
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X aria-hidden="true" size={18} strokeWidth={1.8} />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}
