"use client";

import { useEffect } from "react";

// Next 16.3: retry() vuelve a pedir los datos y re-renderiza el segmento
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-y border-line py-12 text-center">
      <p className="font-serif text-3xl italic">Algo salió mal.</p>
      <p className="mt-3 break-words text-sm text-ink-3">
        {error.digest ? "Revisa tu conexión e inténtalo de nuevo." : error.message}
      </p>
      <button type="button" onClick={() => retry()} className="btn btn-primary mt-6">
        Reintentar
      </button>
    </div>
  );
}
