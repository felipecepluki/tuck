import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className={title === 'Settings' ? 'tuck-dialog settings-dialog' : 'tuck-dialog'}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
