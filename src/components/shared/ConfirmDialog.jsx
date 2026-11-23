import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Replaces window.confirm. Focus starts on "cancel" (Radix default).
 * onConfirm runs the same handler the old confirm() guarded.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  destructive = false,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-md rounded-xl bg-card text-start">
        <AlertDialogHeader className="text-start sm:text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:justify-start sm:space-x-0">
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="mt-0">{cancelLabel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
