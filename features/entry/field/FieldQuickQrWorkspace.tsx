"use client";

import {
  ArrowLeft,
  ChevronRight,
  Download,
  House,
  Link2,
  QrCode,
  Share2,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, useTransition } from "react";
import { recoverCommunityRegistrationLink } from "@/features/entry/communityRegistration/admin/actions";
import type { FieldQuickQrRegistrationOption } from "@/features/entry/field/quickQrData";

const IOS_DOWNLOAD_URL =
  "https://apps.apple.com/us/app/entry-acess-control/id6763486133";
const ANDROID_DOWNLOAD_URL =
  "https://play.google.com/store/apps/details?id=com.minervatechnologies.entry";

type QuickQrHomeView = "home" | "download" | "registration";

type QuickQrPayload =
  | {
      kind: "download";
      platform: "ios" | "android";
      title: string;
      subtitle: string;
      url: string;
    }
  | {
      communityId: string;
      communityName: string;
      kind: "registration";
      title: string;
      subtitle: string;
      url: string;
    };

type FieldQuickQrWorkspaceProps = {
  registrations: FieldQuickQrRegistrationOption[];
};

const utilityCardClass =
  "group flex w-full items-center gap-3 rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4 text-left transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)] active:bg-white/[0.08]";

const iconClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-accent)]";

function BackButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--console-text)]"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {children}
    </button>
  );
}

function QrHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="pt-1">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
        QR rápido
      </p>
      <h1 className="mt-1.5 text-3xl font-semibold text-[var(--console-text)]">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--console-text-muted)]">
        {description}
      </p>
    </section>
  );
}

function PlatformChoices({
  onChoose,
}: {
  onChoose: (platform: "ios" | "android") => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChoose("ios")}
        className={utilityCardClass}
      >
        <span className={iconClass}>
          <Smartphone aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--console-text)]">
            iPhone (iOS)
          </span>
          <span className="mt-0.5 block text-sm text-[var(--console-text-muted)]">
            Abrir App Store
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5 text-[var(--console-accent)]"
        />
      </button>

      <button
        type="button"
        onClick={() => onChoose("android")}
        className={utilityCardClass}
      >
        <span className={iconClass}>
          <TabletSmartphone aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--console-text)]">
            Android
          </span>
          <span className="mt-0.5 block text-sm text-[var(--console-text-muted)]">
            Abrir Google Play
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5 text-[var(--console-accent)]"
        />
      </button>
    </div>
  );
}

function QrResult({
  onBack,
  onChangeRegistration,
  onSwitchPlatform,
  payload,
}: {
  onBack: () => void;
  onChangeRegistration: () => void;
  onSwitchPlatform: (platform: "ios" | "android") => void;
  payload: QuickQrPayload;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(payload.url);
      setFeedback("Enlace copiado");
    } catch {
      setFeedback("No se pudo copiar el enlace");
    }
  }

  async function shareLink() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: payload.title,
          text: payload.subtitle,
          url: payload.url,
        });
        setFeedback(null);
        return;
      }

      await navigator.clipboard.writeText(payload.url);
      setFeedback("Enlace copiado para compartir");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setFeedback("No se pudo compartir el enlace");
    }
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack}>Volver a QR rápidos</BackButton>

      <QrHeader
        title={payload.title}
        description={
          payload.kind === "registration"
            ? "Pídele al residente que escanee este código para abrir su registro."
            : "Pídele a la persona que escanee este código para descargar ENTRY."
        }
      />

      {payload.kind === "download" ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-2">
          <button
            type="button"
            onClick={() => onSwitchPlatform("ios")}
            aria-pressed={payload.platform === "ios"}
            className={[
              "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              payload.platform === "ios"
                ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                : "border-transparent text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]",
            ].join(" ")}
          >
            <Smartphone aria-hidden="true" className="h-4 w-4" />
            iPhone (iOS)
          </button>
          <button
            type="button"
            onClick={() => onSwitchPlatform("android")}
            aria-pressed={payload.platform === "android"}
            className={[
              "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              payload.platform === "android"
                ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                : "border-transparent text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]",
            ].join(" ")}
          >
            <TabletSmartphone aria-hidden="true" className="h-4 w-4" />
            Android
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onChangeRegistration}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-3.5 text-left transition-colors hover:border-[var(--console-accent-border)]"
        >
          <span className={iconClass}>
            <House aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-[var(--console-text-muted)]">
              Residencial
            </span>
            <span className="mt-0.5 block truncate text-base font-semibold text-[var(--console-text)]">
              {payload.communityName}
            </span>
          </span>
          <span className="text-sm font-semibold text-[var(--console-accent)]">
            Cambiar
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
        </button>
      )}

      <section className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4 sm:p-5">
        <div className="mx-auto w-full max-w-[34rem] rounded-2xl bg-white p-3 sm:p-4">
          <QRCodeSVG
            value={payload.url}
            size={640}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
            className="h-auto w-full"
            aria-label={`QR para ${payload.title}`}
          />
        </div>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-[var(--console-text-muted)]">
          {payload.subtitle}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--console-border)] bg-white/[0.02] px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:border-[var(--console-accent-border)] hover:bg-white/[0.05]"
          >
            <Link2 aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
            Copiar enlace
          </button>
          <button
            type="button"
            onClick={shareLink}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10"
          >
            <Share2 aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
            Compartir
          </button>
        </div>

        {feedback ? (
          <p className="mt-3 text-center text-xs font-semibold text-[var(--console-text-muted)]">
            {feedback}
          </p>
        ) : null}
      </section>

      <div className="flex items-center justify-center gap-2 text-xs text-[var(--console-text-muted)]">
        <QrCode aria-hidden="true" className="h-4 w-4" />
        Escaneable desde la cámara de cualquier teléfono compatible.
      </div>
    </div>
  );
}

export function FieldQuickQrWorkspace({
  registrations,
}: FieldQuickQrWorkspaceProps) {
  const [view, setView] = useState<QuickQrHomeView>("home");
  const [payload, setPayload] = useState<QuickQrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showDownload(platform: "ios" | "android") {
    setError(null);
    setPayload({
      kind: "download",
      platform,
      title: "Descargar ENTRY",
      subtitle:
        platform === "ios"
          ? "Escanea para descargar ENTRY en iPhone (iOS)."
          : "Escanea para descargar ENTRY en Android.",
      url: platform === "ios" ? IOS_DOWNLOAD_URL : ANDROID_DOWNLOAD_URL,
    });
  }

  function chooseRegistration(option: FieldQuickQrRegistrationOption) {
    setError(null);

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: option.campaignId,
        communityId: option.communityId,
      });

      if (!result.success) {
        setPayload(null);
        setError(result.error);
        return;
      }

      setPayload({
        communityId: option.communityId,
        communityName: option.communityName,
        kind: "registration",
        title: "Registro de residente",
        subtitle: `Escanea para registrarte en ${option.communityName}.`,
        url: result.data.registrationUrl,
      });
    });
  }

  if (payload) {
    return (
      <QrResult
        payload={payload}
        onBack={() => {
          setPayload(null);
          setView("home");
          setError(null);
        }}
        onChangeRegistration={() => {
          setPayload(null);
          setView("registration");
          setError(null);
        }}
        onSwitchPlatform={showDownload}
      />
    );
  }

  if (view === "download") {
    return (
      <div className="space-y-5">
        <BackButton onClick={() => setView("home")}>Volver a QR rápidos</BackButton>
        <QrHeader
          title="Descargar ENTRY"
          description="Selecciona el tipo de teléfono y Field generará el QR correcto para la tienda."
        />
        <PlatformChoices onChoose={showDownload} />
      </div>
    );
  }

  if (view === "registration") {
    return (
      <div className="space-y-5">
        <BackButton onClick={() => setView("home")}>Volver a QR rápidos</BackButton>
        <QrHeader
          title="Registro de residente"
          description="Selecciona una residencial activa con registro abierto. Field recuperará el enlace vigente antes de mostrar el QR."
        />

        {registrations.length > 0 ? (
          <div className="grid gap-2.5">
            {registrations.map((option) => (
              <button
                key={option.campaignId}
                type="button"
                disabled={pending}
                onClick={() => chooseRegistration(option)}
                className={utilityCardClass}
              >
                <span className={iconClass}>
                  <House aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-[var(--console-text)]">
                    {option.communityName}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--console-text-muted)]">
                    {option.publicTitle}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="h-5 w-5 text-[var(--console-accent)]"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
            <p className="text-base font-semibold text-[var(--console-text)]">
              No hay registros disponibles para compartir
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Aquí aparecerán las residenciales activas que tengan una campaña de
              registro abierta y un enlace seguro recuperable.
            </p>
          </div>
        )}

        {pending ? (
          <p className="text-sm font-semibold text-[var(--console-text-muted)]">
            Preparando enlace seguro...
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <QrHeader
        title="QR rápidos"
        description="Enlaces de campo para registro de residentes y descarga de ENTRY, listos para escanear desde tu teléfono."
      />

      <section className="grid gap-3" aria-label="Herramientas QR">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setView("registration");
          }}
          className={utilityCardClass}
        >
          <span className={iconClass}>
            <House aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              Registro de residente
            </span>
            <span className="mt-0.5 block text-sm leading-5 text-[var(--console-text-muted)]">
              Elige la residencial y genera su QR de registro vigente.
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setView("download");
          }}
          className={utilityCardClass}
        >
          <span className={iconClass}>
            <Download aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[var(--console-text)]">
              Descargar ENTRY
            </span>
            <span className="mt-0.5 block text-sm leading-5 text-[var(--console-text-muted)]">
              Genera un QR para App Store o Google Play.
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-5 w-5 text-[var(--console-accent)]"
          />
        </button>
      </section>

      <div className="rounded-xl border border-[var(--console-border)] bg-white/[0.02] px-4 py-3">
        <div className="flex gap-3">
          <QrCode
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--console-accent)]"
          />
          <p className="text-sm leading-6 text-[var(--console-text-muted)]">
            Los QR de registro no guardan un enlace viejo: Field recupera el
            enlace activo de la campaña cuando seleccionas la residencial.
          </p>
        </div>
      </div>
    </div>
  );
}
