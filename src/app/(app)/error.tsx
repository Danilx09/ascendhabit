"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";

// Next 16.3: retry() vuelve a pedir los datos y re-renderiza el segmento
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-y border-line py-12 text-center">
      <p className="font-serif text-3xl italic">{t.errorPage.title}</p>
      <p className="mt-3 break-words text-sm text-ink-3">{error.digest ? t.errorPage.connection : error.message}</p>
      <button type="button" onClick={() => retry()} className="btn btn-primary mt-6">
        {t.common.retry}
      </button>
    </div>
  );
}
