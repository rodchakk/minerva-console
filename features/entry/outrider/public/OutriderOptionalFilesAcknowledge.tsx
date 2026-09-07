"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

export function OutriderOptionalFilesAcknowledge({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeWithoutFiles() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/entry/outrider/${encodeURIComponent(token)}/available-information/complete`,
        { method: "POST" },
      );
      const body = (await response.json()) as { message?: string; saved?: boolean };

      if (!response.ok || body.saved !== true) {
        throw new Error(body.message || "No pudimos guardar esta confirmacion.");
      }

      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos guardar esta confirmacion.",
      );
      setPending(false);
    }
  }

  return (
    <div className="bg-slate-50 px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-violet-200 bg-violet-50 px-4 py-4 text-slate-950 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-950">Archivos opcionales</p>
            <p className="mt-1 text-sm leading-6 text-violet-900/80">
              Si no tiene documentos para adjuntar por ahora, puede continuar sin
              ellos. Podrá completar el resto de la información normalmente.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void completeWithoutFiles()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-violet-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Continuar sin adjuntar archivos
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
