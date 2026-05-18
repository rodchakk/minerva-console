"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

function getPinFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("pin") ?? "";
}

type Step =
  | "loading"
  | "mobile-redirect"
  | "invalid"
  | "notifications"
  | "password"
  | "success";

type ValidationResult = {
  valid: boolean;
  reason?: string;
  resident_name?: string | null;
  unit_label?: string | null;
  community_name?: string | null;
  activation_method?: string | null;
};

type CompleteResult = {
  success: boolean;
  error?: string;
  login_email?: string;
  username?: string;
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function getPasswordStrength(password: string): { label: string; color: string } | null {
  if (!password) return null;
  if (password.length < 8) return { label: "Muy débil", color: "#FF6B6B" };
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (hasLetter && hasDigit && hasSpecial && password.length >= 10) {
    return { label: "Segura", color: "#34D399" };
  }
  if (hasLetter && hasDigit) return { label: "Aceptable", color: "#FBBF24" };
  return { label: "Débil", color: "#FBBF24" };
}

function mapValidationError(reason: string | undefined): string {
  switch (reason) {
    case "already_activated":
      return "Esta cuenta ya fue activada. Inicia sesión con tu correo y contraseña.";
    case "too_many_attempts":
      return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
    case "queue_not_eligible":
      return "El enlace ya no es válido. Contacta al administrador de tu comunidad.";
    default:
      return "PIN inválido o expirado. Solicita un nuevo enlace de activación.";
  }
}

function mapCompleteError(code: string | undefined): string {
  switch (code) {
    case "pin_already_used":
      return "Esta cuenta ya fue activada.";
    case "invalid_pin":
      return "PIN inválido.";
    case "password_too_short":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "too_many_attempts":
      return "Demasiados intentos. Espera unos minutos.";
    case "email_already_registered":
      return "Ya existe una cuenta con este correo. Intenta iniciar sesión.";
    case "missing_house_match":
      return "Tu unidad no está vinculada correctamente. Contacta al administrador.";
    case "activation_in_progress_retry":
      return "Hay otra activación en curso. Intenta de nuevo en unos segundos.";
    default:
      return "No pudimos completar la activación. Intenta de nuevo.";
  }
}

export default function ActivatePage() {
  const pin = useMemo(getPinFromUrl, []);

  const [step, setStep] = useState<Step>("loading");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [loginEmail, setLoginEmail] = useState<string | null>(null);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validatedRef = useRef(false);
  const deepLinkAttemptedRef = useRef(false);

  const validatePin = useCallback(async () => {
    if (validatedRef.current) return validation;
    validatedRef.current = true;

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "validate_resident_activation_pin_v1",
        { p_pin: pin },
      );

      if (error) {
        setErrorMsg("No pudimos verificar el PIN. Revisa tu conexión.");
        setStep("invalid");
        return null;
      }

      const result = data as ValidationResult | null;
      if (!result?.valid) {
        setErrorMsg(mapValidationError(result?.reason));
        setStep("invalid");
        return null;
      }

      setValidation(result);
      return result;
    } catch {
      setErrorMsg("Error inesperado verificando el enlace.");
      setStep("invalid");
      return null;
    }
  }, [pin, validation]);

  const startWebFlow = useCallback(async () => {
    const result = validation ?? (await validatePin());
    if (!result) return;

    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
    setStep("notifications");
  }, [validation, validatePin]);

  useEffect(() => {
    if (deepLinkAttemptedRef.current) return;
    deepLinkAttemptedRef.current = true;

    if (!pin || !/^\d{6}$/.test(pin)) {
      setErrorMsg("No se encontró un PIN válido en el enlace.");
      setStep("invalid");
      return;
    }

    if (isMobileDevice()) {
      // Show choice screen immediately; validate PIN in the background so
      // the web flow is ready if the user chooses "Continuar en navegador".
      setStep("mobile-redirect");
      void validatePin();
    } else {
      void startWebFlow();
    }
  }, [pin, startWebFlow, validatePin]);

  async function handleRequestNotifications() {
    if (typeof Notification === "undefined") {
      setNotifPermission("unsupported");
      setStep("password");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {
      // user dismissed
    }
    setStep("password");
  }

  function handleSkipNotifications() {
    setStep("password");
  }

  async function handleActivate() {
    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "complete_resident_activation_pin_v1",
      { p_pin: pin, p_password: password },
    );

    setSubmitting(false);

    if (error) {
      setErrorMsg("No pudimos completar la activación. Intenta de nuevo.");
      return;
    }

    const result = data as CompleteResult;
    if (!result?.success) {
      setErrorMsg(mapCompleteError(result?.error));
      return;
    }

    setLoginEmail(result.login_email ?? null);
    setStep("success");
  }

  const headerInfo = validation ? (
    <div className="mb-5 rounded-2xl border border-violet-400/20 bg-violet-500/5 px-4 py-3 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/80">
        Activando como
      </p>
      <p className="mt-1 text-sm font-semibold text-white sm:text-base">
        {validation.resident_name ?? "Residente"}
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {validation.community_name ?? "Comunidad"}
        {validation.unit_label ? ` · ${validation.unit_label}` : ""}
      </p>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,22,0.98))] p-6 text-center shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:max-w-lg sm:rounded-[32px] sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200 sm:text-xs">
          ENTRY · Minerva
        </p>

        {step === "loading" ? (
          <div className="mt-6 sm:mt-8">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              Verificando...
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Estamos validando tu enlace de activación.
            </p>
          </div>
        ) : null}

        {step === "mobile-redirect" ? (
          <div className="mt-6 sm:mt-8">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              ¿Cómo quieres continuar?
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Si ya tienes ENTRY instalado, ábrelo para completar la activación.
              Si no, puedes hacerlo aquí mismo en tu navegador.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a href={`entry://activate?pin=${pin}`} className="w-full">
                <Button className="w-full py-3">Abrir app ENTRY</Button>
              </a>
              <Button
                variant="secondary"
                className="w-full py-3"
                onClick={() => void startWebFlow()}
              >
                Continuar en navegador
              </Button>
            </div>
          </div>
        ) : null}

        {step === "invalid" ? (
          <div className="mt-6 sm:mt-8">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              Enlace no válido
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {errorMsg ?? "Este enlace ya no funciona."}
            </p>
          </div>
        ) : null}

        {step === "notifications" ? (
          <div className="mt-6 text-left sm:mt-8">
            {headerInfo}
            <h1 className="text-center text-xl font-semibold text-white sm:text-2xl">
              {notifPermission === "granted"
                ? "Notificaciones activadas"
                : notifPermission === "denied"
                  ? "Notificaciones bloqueadas"
                  : notifPermission === "unsupported"
                    ? "Notificaciones no disponibles"
                    : "Activa las notificaciones"}
            </h1>
            <p className="mt-3 text-center text-sm leading-6 text-[var(--text-muted)]">
              {notifPermission === "granted"
                ? "Este navegador recibirá alertas de acceso y comunicados de tu residencial."
                : notifPermission === "denied"
                  ? "Las notificaciones están bloqueadas. Puedes activarlas desde la configuración del navegador."
                  : notifPermission === "unsupported"
                    ? "Tu navegador no soporta notificaciones web. Continúa con el siguiente paso."
                    : "ENTRY usa notificaciones para avisarte sobre accesos, comunicados y alertas importantes de tu residencial."}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {notifPermission === "default" ? (
                <>
                  <Button className="py-3" onClick={handleRequestNotifications}>
                    Permitir notificaciones
                  </Button>
                  <Button
                    variant="secondary"
                    className="py-3"
                    onClick={handleSkipNotifications}
                  >
                    Ahora no
                  </Button>
                </>
              ) : (
                <Button className="py-3" onClick={() => setStep("password")}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {step === "password" ? (
          <div className="mt-6 text-left sm:mt-8">
            {headerInfo}
            <h1 className="text-center text-xl font-semibold text-white sm:text-2xl">
              Crea tu contraseña
            </h1>
            <p className="mt-3 text-center text-sm leading-6 text-[var(--text-muted)]">
              Será tu contraseña para iniciar sesión en ENTRY.
            </p>

            <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Nueva contraseña
            </label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={submitting}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 pr-20 text-base text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password.length >= 8 && !submitting) {
                    void handleActivate();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-200 hover:text-violet-100"
                tabIndex={-1}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Mínimo 8 caracteres.</span>
              {passwordStrength ? (
                <span style={{ color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              ) : null}
            </div>

            {errorMsg ? (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {errorMsg}
              </div>
            ) : null}

            <div className="mt-6">
              <Button
                onClick={handleActivate}
                disabled={submitting || password.length < 8}
                className="w-full py-3"
              >
                {submitting ? "Activando..." : "Crear contraseña"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "success" ? (
          <div className="mt-6 sm:mt-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-7 w-7 text-emerald-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-white sm:text-2xl">
              ¡Cuenta activada!
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Tu cuenta de ENTRY está lista. Abre el app para iniciar sesión.
            </p>
            {loginEmail ? (
              <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/5 px-4 py-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/80">
                  Tu correo de login
                </p>
                <p className="mt-1 break-all text-sm font-medium text-violet-100">
                  {loginEmail}
                </p>
              </div>
            ) : null}
            <div className="mt-6">
              <a href="entry://" className="block w-full">
                <Button className="w-full py-3">Abrir app ENTRY</Button>
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
