import type { PropsWithChildren, ReactNode } from "react";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  onClose(): void;
  title: string;
  eyebrow?: string;
  headerSlot?: ReactNode;
}

export function Modal({ open, onClose, title, eyebrow, headerSlot, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            {eyebrow ? <p className="eyebrow-mini">{eyebrow}</p> : null}
            <h2 className="modal-title">{title}</h2>
          </div>
          <div className="modal-header-actions">
            {headerSlot}
            <button className="ghost-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
