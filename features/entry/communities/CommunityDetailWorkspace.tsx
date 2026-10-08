"use client";

import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPinned,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CommunityAdminActivityPreview } from "@/features/entry/communities/activityQueries";
import { cn } from "@/lib/supabase/utils";

type WorkspaceTab = "overview" | "setup" | "activity";
type ModalKind = "registration" | "destinations" | null;

type CommunityDetailWorkspaceProps = {
  activityControl: ReactNode;
  activityItems: CommunityAdminActivityPreview[];
  adminActivityCount: number | null;
  communityId: string;
  destinationActiveCount: number;
  destinationsManager: ReactNode;
  facilityControl: ReactNode;
  facilitiesLabel: string;
  initialTab?: WorkspaceTab;
  memberCount: number;
  nextActionDescription: string;
  nextActionHref: string;
  nextActionLabel: string;
  pendingActivationCount: number;
  registrationManager: ReactNode;
  registrationStatus: string;
  registrationSubmittedResidents: number;
  registrationSubmittedUnits: number;
  setupPanel: ReactNode;
  unitCount: number;
};

function WorkspaceButton({
  children,
  href,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const className = cn(
    "inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#7553FF]",
    primary
      ? "border-[#120539] bg-[#7553FF] text-white shadow-[0_2px_0_#120539]"
      : "border-[#141119] bg-[#2E2936] text-white shadow-[0_2px_0_#141119] hover:bg-[#342F3D]",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function OperationRow({
  action,
  description,
  icon: Icon,
  stat,
  statNote,
  title,
}: {
  action: ReactNode;
  description: string;
  icon: typeof Users;
  stat: string;
  statNote: string;
  title: string;
}) {
  return (
    <div className="grid gap-4 border-b border-[#141119] px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_minmax(190px,.72fr)_160px] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-white/[0.10] bg-white/[0.018] text-[#D8D3E7]">
          <Icon className="size-4 stroke-[1.7]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#A9A3B2]">
            {description}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-white">{stat}</p>
        <p className="mt-1 text-[11px] text-[#8F879D]">{statNote}</p>
      </div>

      <div className="flex md:justify-end">{action}</div>
    </div>
  );
}

function WorkspaceModal({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="grid max-h-[90vh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[12px] border border-[#141119] bg-[#26222F] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#141119] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-xs text-[#A9A3B2]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

export function CommunityDetailWorkspace({
  activityControl,
  activityItems,
  adminActivityCount,
  communityId,
  destinationActiveCount,
  destinationsManager,
  facilityControl,
  facilitiesLabel,
  initialTab = "overview",
  memberCount,
  nextActionDescription,
  nextActionHref,
  nextActionLabel,
  pendingActivationCount,
  registrationManager,
  registrationStatus,
  registrationSubmittedResidents,
  registrationSubmittedUnits,
  setupPanel,
  unitCount,
}: CommunityDetailWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [modal, setModal] = useState<ModalKind>(null);
  const recentActivity = activityItems.slice(0, 3);

  return (
    <>
      <nav className="flex gap-5 border-b border-white/[0.07]">
        {[
          ["overview", "Overview"],
          ["setup", "Setup"],
          ["activity", "Activity"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as WorkspaceTab)}
            className={cn(
              "relative py-2.5 text-xs font-semibold transition",
              tab === value
                ? "text-white after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#7553FF]"
                : "text-[#8F879D] hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
            <div className="border-b border-[#141119] px-5 py-4">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
                Community operations
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
                Open the workspace you need without loading every dataset into this screen.
              </p>
            </div>

            <OperationRow
              icon={Users}
              title="Residents & units"
              description="Manage households, residents, ownership, and unit-level access."
              stat={unitCount + " units · " + memberCount + " residents"}
              statNote={
                pendingActivationCount === 0
                  ? "No pending activations"
                  : pendingActivationCount + " pending activation" + (pendingActivationCount === 1 ? "" : "s")
              }
              action={
                <WorkspaceButton
                  href={"/products/entry/communities/" + communityId + "/units"}
                >
                  Open directory
                  <ChevronRight className="size-3.5" aria-hidden />
                </WorkspaceButton>
              }
            />

            <OperationRow
              icon={Clock3}
              title="Activation queue"
              description="Review residents prepared for activation and continue invitation or PIN workflows."
              stat={
                pendingActivationCount +
                " pending resident" +
                (pendingActivationCount === 1 ? "" : "s")
              }
              statNote={
                pendingActivationCount === 0
                  ? "Queue is currently clear"
                  : "Residents waiting for activation"
              }
              action={
                <WorkspaceButton
                  href={"/products/entry/activation?community_id=" + communityId}
                  primary={pendingActivationCount > 0}
                >
                  Open queue
                  <ChevronRight className="size-3.5" aria-hidden />
                </WorkspaceButton>
              }
            />

            <OperationRow
              icon={ClipboardCheck}
              title="Resident registration"
              description="Public resident intake, campaign controls, and internal review."
              stat={registrationStatus}
              statNote={
                registrationSubmittedUnits +
                " units · " +
                registrationSubmittedResidents +
                " residents received"
              }
              action={
                <WorkspaceButton
                  onClick={() => setModal("registration")}
                  primary={registrationSubmittedUnits > 0}
                >
                  Manage registration
                </WorkspaceButton>
              }
            />

            <OperationRow
              icon={MapPinned}
              title="Manual access destinations"
              description="Destinations guards can select during manual access."
              stat={destinationActiveCount + " active destination" + (destinationActiveCount === 1 ? "" : "s")}
              statNote="Managed separately from community units"
              action={
                <WorkspaceButton onClick={() => setModal("destinations")}>
                  View destinations
                  <ChevronRight className="size-3.5" aria-hidden />
                </WorkspaceButton>
              }
            />

            <OperationRow
              icon={CalendarDays}
              title="Facilities & reservations"
              description="Reservable community spaces and operating rules."
              stat={facilitiesLabel}
              statNote="Facility configuration and availability"
              action={facilityControl}
            />
          </section>

          <aside className="grid gap-3">
            <section className="rounded-[10px] border border-[#141119] bg-[#24202B] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
                Next action
              </p>
              <div className="mt-3 rounded-lg border border-[rgba(117,83,255,0.22)] bg-[rgba(117,83,255,0.06)] p-3.5">
                <p className="text-sm font-semibold text-white">{nextActionLabel}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#A9A3B2]">
                  {nextActionDescription}
                </p>
                <div className="mt-3">
                  <WorkspaceButton href={nextActionHref} primary>
                    {nextActionLabel}
                  </WorkspaceButton>
                </div>
              </div>
            </section>

            <section className="rounded-[10px] border border-[#141119] bg-[#24202B] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
                Operational snapshot
              </p>
              <div className="mt-3 divide-y divide-white/[0.06]">
                {[
                  ["Activation queue", String(pendingActivationCount)],
                  ["Registration intake", String(registrationSubmittedUnits)],
                  ["Active destinations", String(destinationActiveCount)],
                  ["Admin activity", adminActivityCount === null ? "—" : String(adminActivityCount)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-xs text-[#A9A3B2]">{label}</span>
                    <strong className="text-xs font-semibold text-white">{value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[10px] border border-[#141119] bg-[#24202B] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
                Recent activity
              </p>

              {recentActivity.length > 0 ? (
                <div className="mt-2 divide-y divide-white/[0.06]">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex gap-2.5 py-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#67D7A5]" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {item.summary}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8F879D]">
                          {item.createdAt} · {item.actorName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-[#A9A3B2]">
                  No recent administrative activity is available.
                </p>
              )}

              <div className="mt-3">{activityControl}</div>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "setup" ? <div>{setupPanel}</div> : null}

      {tab === "activity" ? (
        <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
          <div className="flex items-end justify-between gap-4 border-b border-[#141119] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
                Community activity
              </h2>
              <p className="mt-1 text-sm text-[#A9A3B2]">
                Recent administrative events for this community.
              </p>
            </div>
            {activityControl}
          </div>

          {activityItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[42%]" />
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#1F1B26] text-[10px] uppercase tracking-[0.14em] text-[#8F879D]">
                    <th className="border-b border-[#141119] px-5 py-3 font-medium">Time</th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">Event</th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">Target</th>
                    <th className="border-b border-[#141119] px-4 py-3 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {activityItems.slice(0, 12).map((item) => (
                    <tr key={item.id} className="border-b border-[#141119] last:border-b-0">
                      <td className="px-5 py-3 text-xs text-[#A9A3B2]">{item.createdAt}</td>
                      <td className="px-4 py-3 text-xs font-medium text-white">{item.summary}</td>
                      <td className="px-4 py-3 text-xs text-[#CFC9D6]">{item.targetType}</td>
                      <td className="px-4 py-3 text-xs text-[#CFC9D6]">{item.actorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-[#A9A3B2]">
              No administrative activity is available yet.
            </div>
          )}
        </section>
      ) : null}

      {modal === "registration" ? (
        <WorkspaceModal
          title="Resident registration"
          subtitle="Campaign controls, sharing, and review access."
          onClose={() => setModal(null)}
        >
          {registrationManager}
        </WorkspaceModal>
      ) : null}

      {modal === "destinations" ? (
        <WorkspaceModal
          title="Manual access destinations"
          subtitle="Manage destinations available to guards during manual access."
          onClose={() => setModal(null)}
        >
          {destinationsManager}
        </WorkspaceModal>
      ) : null}
    </>
  );
}
