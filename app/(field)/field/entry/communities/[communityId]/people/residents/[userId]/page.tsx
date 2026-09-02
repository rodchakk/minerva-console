import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldResidentActions } from "@/features/entry/field/FieldResidentActions";
import { FieldResidentProfileEditor } from "@/features/entry/field/FieldResidentProfileEditor";
import { FieldResidentStatusAction } from "@/features/entry/field/FieldResidentStatusAction";
import { getFieldResidentDetailData } from "@/features/entry/field/peopleData";

type FieldResidentDetailPageProps = {
  params: Promise<{ communityId: string; userId: string }>;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
        {label}
      </p>
      <p className="mt-1 break-words text-base text-[var(--console-text)]">
        {value || "Not available"}
      </p>
    </div>
  );
}

export default async function FieldResidentDetailPage({
  params,
}: FieldResidentDetailPageProps) {
  const { communityId, userId } = await params;
  const data = await getFieldResidentDetailData(communityId, userId);

  if (!data.community) {
    notFound();
  }

  if (data.residents.state === "unavailable") {
    return (
      <div className="space-y-5">
        <Link
          href={`/field/entry/communities/${encodeURIComponent(communityId)}/people`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          People and units
        </Link>
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          User detail unavailable.
        </section>
      </div>
    );
  }

  if (!data.resident) {
    notFound();
  }

  const isResident = data.resident.role === "RESIDENT";
  const isReadOnlyPreview = isEntryPreviewReadOnly();
  const householdResidents = isResident
    ? data.residents.items.filter(
        (resident) =>
          resident.role === "RESIDENT" &&
          resident.houseId &&
          resident.houseId === data.resident?.houseId,
      )
    : [];
  const currentUnit =
    isResident && data.units.state === "ready"
      ? data.units.items.find((unit) => unit.id === data.resident?.houseId) ?? null
      : null;
  const backToUnit = isResident && Boolean(data.resident.houseId);

  return (
    <div className="space-y-5">
      <Link
        href={
          backToUnit
            ? `/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(data.resident.houseId)}`
            : `/field/entry/communities/${encodeURIComponent(communityId)}/people`
        }
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backToUnit ? data.resident.houseLabel : "People and units"}
      </Link>

      {isResident && data.resident.houseId ? (
        <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
                Household
              </p>
              <h1 className="mt-1 break-words text-2xl font-semibold leading-8 text-[var(--console-text)]">
                {data.resident.houseLabel}
              </h1>
              <p className="mt-1 text-sm text-[var(--console-text-muted)]">
                {householdResidents.length} resident{householdResidents.length === 1 ? "" : "s"}
              </p>
            </div>
            {currentUnit?.isActive ? (
              <Link
                href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(data.resident.houseId)}/residents/new`}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-3 text-sm font-semibold text-white"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add resident
              </Link>
            ) : null}
          </div>

          <div className="space-y-2">
            {householdResidents.map((resident) => {
              const isSelected = resident.userId === data.resident?.userId;

              return (
                <Link
                  key={resident.userId}
                  href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/residents/${encodeURIComponent(resident.userId)}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-[var(--console-accent)] bg-[var(--console-accent)]/10"
                      : "border-[var(--console-border)] bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                      {resident.fullName}
                    </span>
                    <span className="mt-1 block break-words text-sm text-[var(--console-text-muted)]">
                      {resident.identity}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                      resident.isActive
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-white/15 bg-white/5 text-[var(--console-text-soft)]"
                    }`}
                  >
                    {resident.accountState}
                  </span>
                </Link>
              );
            })}
          </div>

          <p className="text-xs leading-5 text-[var(--console-text-soft)]">
            Select any resident above to manage that account.
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Selected user
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
            {data.resident.fullName}
          </h2>
          <span className="rounded-full border border-[var(--console-border)] bg-white/[0.04] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--console-text-muted)]">
            {data.resident.role}
          </span>
        </div>
      </section>

      <section className="grid gap-3">
        <DetailRow label="Role" value={data.resident.role} />
        <DetailRow label="Current unit" value={data.resident.houseLabel} />
        <DetailRow label="Login identity" value={data.resident.identity} />
        <DetailRow label="Phone" value={data.resident.phone} />
        <DetailRow label="Account state" value={data.resident.accountState} />
      </section>

      {isResident ? (
        <>
          <FieldResidentProfileEditor
            communityId={data.community.id}
            isReadOnlyPreview={isReadOnlyPreview}
            resident={data.resident}
          />

          <FieldResidentActions
            communityId={data.community.id}
            isReadOnlyPreview={isReadOnlyPreview}
            resident={data.resident}
            unitState={data.units.state}
            units={data.units.state === "ready" ? data.units.items : []}
          />

          <FieldResidentStatusAction
            communityId={data.community.id}
            isReadOnlyPreview={isReadOnlyPreview}
            resident={data.resident}
          />
        </>
      ) : (
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          This {data.resident.role.toLowerCase()} account is visible in Field People.
          Resident-only actions are not available for this role.
        </section>
      )}
    </div>
  );
}
