"use client";

import { useEffect } from "react";

/** Hoja inferior reutilizable (cierra con Escape o tocando fuera) */
export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="safe-bottom relative max-h-[90dvh] w-full max-w-md overflow-y-auto border-t border-line bg-bg px-6 pb-8 pt-5">
        <div className="mx-auto mb-6 h-px w-10 bg-ink-3" />
        {children}
      </div>
    </div>
  );
}
