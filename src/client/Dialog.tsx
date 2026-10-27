import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = element.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={element}
      className={`cw-dialog ${wide ? "cw-dialog-wide" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <header className="cw-dialog-head">
        <h2>{title}</h2>
        <button className="cw-icon" aria-label="关闭窗口" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
