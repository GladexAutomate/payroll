import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

/**
 * Centered confirmation / alert bubble.
 * - When onConfirm is provided: shows Cancel + Confirm (confirmation dialog).
 * - When onConfirm is omitted: shows a single OK button (alert dialog).
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {title && <AlertDialogTitle>{title}</AlertDialogTitle>}
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {onConfirm ? (
            <>
              <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                onClick={onConfirm}
              >
                {confirmLabel}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={() => onOpenChange?.(false)}>OK</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}