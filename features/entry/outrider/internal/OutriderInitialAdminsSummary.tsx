import type { OutriderDetail } from "@/features/entry/outrider/queries";

export function OutriderInitialAdminsSummary({
  detail,
}: {
  detail: OutriderDetail;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
        Initial access
      </p>
      <h2 className="mt-2 text-xl font-semibold text-white">
        Administradores iniciales
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        Personas que deben prepararse primero para activación administrativa en ENTRY.
      </p>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Cantidad declarada
        </p>
        <p className="mt-2 text-sm font-semibold text-white">
          {detail.initialAdminCount === null
            ? "Not answered"
            : detail.initialAdminCount}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {detail.initialAdmins.length > 0 ? (
          detail.initialAdmins.map((administrator, index) => (
            <div
              key={`${administrator.name ?? "admin"}-${index}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Administrador {index + 1}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {administrator.name ?? "Name not provided"}
              </p>
              <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                <p>Unidad: {administrator.unit ?? "Not provided"}</p>
                <p>Teléfono: {administrator.phone ?? "Not provided"}</p>
                <p>Correo: {administrator.email ?? "Not provided"}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="md:col-span-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            No initial administrators provided.
          </p>
        )}
      </div>
    </section>
  );
}
