"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  isOutriderEditable,
  type OutriderFileRecord,
  type OutriderStatus,
} from "@/features/entry/outrider/model";

type Props = {
  files: OutriderFileRecord[];
  status: OutriderStatus;
  token: string;
};

function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function OutriderPublicFileManager({ files, status, token }: Props) {
  const router = useRouter();
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = isOutriderEditable(status);
  const sourceFile = useMemo(
    () => files.find((file) => file.category === "community_data") ?? null,
    [files],
  );

  if (!sourceFile || !editable) return null;

  async function removeSourceFile() {
    if (!sourceFile || deletingFileId) return;

    const confirmed = window.confirm(
      `¿Eliminar “${sourceFile.originalFilename}”? Podrá cargar otro archivo después.`,
    );
    if (!confirmed) return;

    setDeletingFileId(sourceFile.id);
    setError(null);

    try {
      const response = await fetch(
        `/entry/outrider/${encodeURIComponent(token)}/upload/delete`,
        {
          body: JSON.stringify({ fileId: sourceFile.id }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const body = (await response.json()) as {
        deleted?: boolean;
        message?: string;
      };

      if (!response.ok || body.deleted !== true) {
        throw new Error(body.message || "No pudimos eliminar el archivo.");
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos eliminar el archivo.",
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  return (
    <div className="bg-slate-50 px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Archivo enviado
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {sourceFile.originalFilename}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {fileSizeLabel(sourceFile.byteSize)} · Puede eliminarlo si cargó el archivo equivocado.
            </p>
          </div>
          <button
            type="button"
            disabled={deletingFileId !== null}
            onClick={() => void removeSourceFile()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deletingFileId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eliminar archivo
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
