"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type {
  CommunityDetailPreviews,
  CommunityUserPreview,
} from "@/features/entry/communities/detailQueries";

type UserFilter =
  | "all"
  | "admins"
  | "guards"
  | "residents"
  | "active"
  | "inactive";

type CommunityUsersDrawerProps = {
  communityId: string;
  state: CommunityDetailPreviews["users"]["state"];
  triggerLabel?: string;
  users: CommunityUserPreview[];
};

const filters: Array<{ label: string; value: UserFilter }> = [
  { label: "All", value: "all" },
  { label: "Admins", value: "admins" },
  { label: "Guards", value: "guards" },
  { label: "Residents", value: "residents" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function getStatusTone(user: CommunityUserPreview) {
  return user.isActive ? "success" : "default";
}

function getStateCopy(
  state: CommunityUsersDrawerProps["state"],
  hasResults: boolean,
) {
  if (state === "disabled") {
    return {
      body: "User review is disabled for this community right now.",
      title: "User review disabled",
    };
  }

  if (state === "unavailable") {
    return {
      body: "The user preview could not be loaded right now.",
      title: "Preview unavailable",
    };
  }

  if (!hasResults || state === "empty") {
    return {
      body: "Add or activate users later to review them from this workspace.",
      title: "No users available",
    };
  }

  return null;
}

function getRoleFilterMatch(user: CommunityUserPreview, filter: UserFilter) {
  const normalizedRole = user.role.trim().toLowerCase();

  switch (filter) {
    case "admins":
      return normalizedRole === "admin";
    case "guards":
      return normalizedRole === "guard";
    case "residents":
      return normalizedRole === "resident";
    case "active":
      return user.isActive;
    case "inactive":
      return !user.isActive;
    default:
      return true;
  }
}

export function CommunityUsersDrawer({
  communityId,
  state,
  triggerLabel = "Review users",
  users,
}: CommunityUsersDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(users[0]?.id ?? null);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.fullName.toLowerCase().includes(normalizedQuery) ||
        user.contact.toLowerCase().includes(normalizedQuery) ||
        user.houseLabel.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      return getRoleFilterMatch(user, filter);
    });
  }, [filter, query, users]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filteredUsers.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredUsers.some((user) => user.id === selectedId)) {
      setSelectedId(filteredUsers[0]?.id ?? null);
    }
  }, [filteredUsers, open, selectedId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedId) ??
    filteredUsers[0] ??
    users[0] ??
    null;
  const activeCount = users.filter((user) => user.isActive).length;
  const residentCount = users.filter(
    (user) => user.role.trim().toLowerCase() === "resident",
  ).length;
  const operatorCount = users.filter((user) => {
    const normalizedRole = user.role.trim().toLowerCase();
    return normalizedRole === "admin" || normalizedRole === "guard";
  }).length;
  const stateCopy = getStateCopy(state, users.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-violet-200 transition hover:text-white"
      >
        {triggerLabel} {"->"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close users drawer"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-6xl flex-col border-l border-white/10 bg-[rgba(7,11,22,0.98)] shadow-[-28px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Entry community
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Users workspace
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Search, filter, and review users without leaving Community Review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl text-[var(--text-muted)] transition hover:border-violet-300/40 hover:text-white"
                aria-label="Close users drawer"
              >
                x
              </button>
            </div>

            <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Total users
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{users.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Active
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{activeCount}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Residents
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{residentCount}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Operators
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{operatorCount}</p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              {stateCopy ? (
                <div className="grid min-h-0 flex-1 place-items-center rounded-[28px] border border-dashed border-white/10 bg-[var(--surface)] px-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-white">{stateCopy.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {stateCopy.body}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)]">
                    Community ID: {communityId}
                  </div>

                  <label className="relative mt-4 block">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                      /
                    </span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by name, contact, or linked unit..."
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {filters.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFilter(item.value)}
                        className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          filter === item.value
                            ? "border-violet-300/50 bg-[var(--primary)] text-white shadow-[0_14px_32px_rgba(112,104,255,0.28)]"
                            : "border-white/10 bg-white/5 text-[var(--text-muted)] hover:border-violet-300/40 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[var(--surface)]">
                    <div className="grid grid-cols-[minmax(180px,1.15fr)_110px_minmax(180px,1fr)_minmax(140px,1fr)_110px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      <span>User</span>
                      <span className="text-center">Role</span>
                      <span>Contact</span>
                      <span>Linked unit</span>
                      <span className="text-right">Status</span>
                    </div>

                    {filteredUsers.length === 0 ? (
                      <div className="grid h-64 place-items-center px-6 text-center">
                        <div>
                          <p className="text-base font-semibold text-white">
                            No users match this view
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            Try another filter or clear the search field.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-[46vh] overflow-y-auto px-3 py-3">
                        {filteredUsers.map((user) => {
                          const selected = user.id === selectedUser?.id;

                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => setSelectedId(user.id)}
                              className={`grid w-full grid-cols-[minmax(180px,1.15fr)_110px_minmax(180px,1fr)_minmax(140px,1fr)_110px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                selected
                                  ? "border-violet-300/50 bg-violet-400/12 shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                                  : "border-transparent hover:border-white/10 hover:bg-white/5"
                              }`}
                            >
                              <span className="font-semibold text-white">{user.fullName}</span>
                              <span className="text-center font-semibold text-white">
                                {user.role}
                              </span>
                              <span className="truncate text-[var(--text-muted)]">
                                {user.contact}
                              </span>
                              <span className="truncate text-[var(--text-muted)]">
                                {user.houseLabel}
                              </span>
                              <span className="text-right">
                                <Badge tone={getStatusTone(user)}>
                                  {user.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-white/10 bg-[rgba(9,12,24,0.84)] px-6 py-5">
              {selectedUser ? (
                <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl font-semibold text-white">
                        U
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                          Selected user
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedUser.fullName}
                          </h3>
                          <Badge tone={getStatusTone(selectedUser)}>
                            {selectedUser.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--text-muted)]">
                      Read-only
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-5">
                    {[
                      ["Name", selectedUser.fullName],
                      ["Role", selectedUser.role],
                      ["Contact", selectedUser.contact],
                      ["Linked unit", selectedUser.houseLabel],
                      ["Status", selectedUser.isActive ? "Active" : "Inactive"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3"
                      >
                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      "Edit profile",
                      "Account tools",
                      "Access review",
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled
                        className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]"
                      >
                        {label} <span className="ml-2 text-xs">Coming soon</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
                  Select a user to see details here.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
