import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldAdminProfileEditor } from "@/features/entry/field/FieldAdminProfileEditor";
import { FieldAdminUnitAssignment } from "@/features/entry/field/FieldAdminUnitAssignment";
import { FieldResidentActions } from "@/features/entry/field/FieldResidentActions";
import { FieldUserStatusAction } from "@/features/entry/field/FieldUserStatusAction";
import { getFieldResidentDetailData } from "@/features/entry/field/peopleData";

type FieldResidentDetailPageProps = {
  params: Promise<{ communityId: string; userId: string }>;
};

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--console-border)] py-3 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--console-text-soft)]">
        {label}
      </p>
      <p className="max-w-[65%] break-words text-right text-sm font-medium text-[var(--console-text)]">
        {value || "Not available"}
      </p>
    </div>
  );
}

export default async function FieldResidentDetailPage({
  params,
}: FieldResidentDetailPageProps) {
  const { communityId, userId } = await params;
  const [operator, data] = await Promise.all([
    requireSuperadmin(),
    getFieldResidentDetailData(communityId, userId),
  ]);

  if (!data.community) notFound();

  if (data.residents.state === "unavailable") {
    return (
      <div className="space-y-5">
        <Link
          href="/field/entry/people"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          People
        </Link>
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          User detail unavailable.
        </section>
      </div>
    );
  }

  if (!data.resident) notFound();

  const isResident = data.resident.role === "RESIDENT";
  const isAdmin = data.resident.role === "ADMIN";
  const isCurrentUser = operator.user.id === data.resident.userId;
  const isReadOnlyPreview = isEntryPreviewReadOnly();
  const householdResidents = isResident
    ? data.residents.items.filter(
        (resident) =>
          resident.role === "RESIDENT" &&
          resident.houseId &&
          resident.houseId === data.resident?.houseId,
      )
    : [];

  return (
    <div className="space-y-5">
      <Link
        href="/field/entry/people"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        People
      </Link>

      <section className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-100">
            {data.resident.role}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
              data.resident.isActive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-[var(--console-text-soft)]"
            }`}
          >
            {data.resident.accountState}
          </span>
        </div>
        <h1 className="break-words text-3xl font-semibold leading-9 text-[var(--console-text)]">
          {data.resident.fullName}
        </h1>
        <p className="text-sm leading-5 text-[var(--console-text-muted)]">
          {data.resident.houseLabel} · {data.community.name}
        </p>
        <p className="break-words text-sm leading-5 text-[var(--console-text-soft)]">
          {data.resident.identity}
        </p>
      </section>

      {isResident ? (
        <FieldResidentActions
          communityId={data.community.id}
          isReadOnlyPreview={isReadOnlyPreview}
          resident={data.resident}
          unitState={data.units.state}
          units={data.units.state === "ready" ? data.units.items : []}
        />
      ) : null}

      {isResident && data.resident.houseId ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Household
          </p>
          <Link
            href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(data.resident.houseId)}`}
            className="group flex min-h-20 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)]"
          >
            <span className="min-w-0">
              <span className="block break-words text-base font-semibold text-[var(--console-text)]">
                {data.resident.houseLabel}
              </span>
              <span className="mt-1 block text-sm text-[var(--console-text-muted)]">
                {householdResidents.length} resident{householdResidents.length === 1 ? "" : "s"}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
            />
          </Link>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="resident-account-title">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
          Account
        </p>
        <div
          id="resident-account-title"
          className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-4"
        >
          <AccountRow label="Role" value={data.resident.role} />
          <AccountRow label="Login identity" value={data.resident.identity} />
          <AccountRow label="Phone" value={data.resident.phone} />
        </div>
      </section>

      {!isResident && isAdmin ? (
        <>
          <FieldAdminProfileEditor
            communityId={data.community.id}
            isReadOnlyPreview={isReadOnlyPreview}
            user={data.resident}
          />
          <FieldAdminUnitAssignment
            communityId={data.community.id}
            isReadOnlyPreview={isReadOnlyPreview}
            unitState={data.units.state}
            units={data.units.state === "ready" ? data.units.items : []}
            user={data.resident}
          />
        </>
      ) : !isResident ? (
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 text-sm leading-6 text-[var(--console-text-muted)]">
          This {data.resident.role.toLowerCase()} account is visible in Field People. Resident-only profile, unit, and recovery actions are not available for this role.
        </section>
      ) : null}

      <FieldUserStatusAction
        communityId={data.community.id}
        isCurrentUser={isCurrentUser}
        isReadOnlyPreview={isReadOnlyPreview}
        user={data.resident}
      />
    </div>
  );
}
