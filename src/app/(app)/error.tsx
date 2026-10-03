"use client";

import { useEffect } from "react";

// Next 16.3: retry() vuelve a pedir los datos y re-renderiza el segmento
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-10 text-center">
      <p className="text-3xl">😵</p>
      <p className="mt-3 font-semibold">Algo salió mal</p>
      <p className="mt-1 break-words text-sm text-zinc-500">
        {error.digest ? "Revisa tu conexión e inténtalo de nuevo." : error.message}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white"
      >
        Reintentar
      </button>
    </div>
  );
}
