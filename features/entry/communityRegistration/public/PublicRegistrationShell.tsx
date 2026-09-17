import Image from "next/image";
import styles from "./PublicRegistrationShell.module.css";

export type RegistrationStep = 1 | 2 | 3 | 4;

const STEPS: Array<{ id: RegistrationStep; label: string }> = [
  { id: 1, label: "Unidad" },
  { id: 2, label: "Residentes" },
  { id: 3, label: "Revisión" },
];

export function RegistrationStepper({
  currentStep,
  isComplete = false,
  includesReference = false,
}: {
  currentStep: RegistrationStep;
  isComplete?: boolean;
  includesReference?: boolean;
}) {
  const steps = includesReference
    ? [
        { id: 1, label: "Unidad" },
        { id: 2, label: "Referencia" },
        { id: 3, label: "Residentes" },
        { id: 4, label: "Revisión" },
      ]
    : STEPS;

  return (
    <nav aria-label="Progreso del registro" className="w-full">
      <ol
        className={`grid ${includesReference ? "grid-cols-4" : "grid-cols-3"} items-start gap-0`}
      >
        {steps.map((step, index) => {
          const completed = isComplete || step.id < currentStep;
          const active = !isComplete && step.id === currentStep;

          return (
            <li className="relative flex flex-col items-center gap-1.5" key={step.id}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-[15px] h-px w-full sm:top-[18px] ${
                    completed ? "bg-[#5b21b6]" : "bg-slate-200"
                  }`}
                />
              ) : null}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm ${
                  active
                    ? "border-[#5b21b6] bg-[#4c1d95] text-white shadow-[0_6px_18px_rgba(91,33,182,0.22)]"
                    : completed
                      ? "border-[#5b21b6] bg-[#5b21b6] text-white"
                      : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {completed ? (
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m6 12 4 4 8-9"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                  </svg>
                ) : (
                  step.id
                )}
              </span>
              <span
                className={`text-center text-[11px] font-medium leading-4 sm:text-sm ${
                  active
                    ? "text-[#35137a]"
                    : completed
                      ? "text-[#4c1d95]"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function EntryBadge() {
  return (
    <span className="inline-flex rounded-full bg-[#efe7ff] px-4 py-1.5 text-xs font-bold uppercase text-[#4c1d95]">
      ENTRY
    </span>
  );
}

export function PublicRegistrationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className={`${styles.registrationPolish} min-h-screen bg-[#f8fafc] text-slate-950`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-8 sm:pt-8">
        <div className="flex-1">{children}</div>
        <footer className="mt-6 border-t border-slate-200/80 pt-4 sm:mt-8">
          <div className="flex flex-col items-center gap-2">
            <Image
              alt="Minerva Technologies"
              className="h-auto w-40 opacity-75 sm:w-44"
              height={714}
              src="/brand/minerva-logo-gray.png"
              width={2129}
            />
            <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              Tus datos están protegidos
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
