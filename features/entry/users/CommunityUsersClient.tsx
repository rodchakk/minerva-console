"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  setCommunityUserActiveStatusAction,
  updateCommunityUserAction,
} from "@/features/entry/users/actions";
import type {
  CommunityUserHouse,
  CommunityUserRecord,
  CommunityUsersPageCommunity,
} from "@/features/entry/users/queries";

type RoleFilter = "all" | "ADMIN" | "RESIDENT" | "GUARD" | "UNASSIGNED";
type StatusFilter = "all" | "active" | "inactive";
type AuthFilter = "all" | "email" | "username" | "synthetic";

type CommunityUsersClientProps = {
  community: CommunityUsersPageCommunity;
  houses: CommunityUserHouse[];
  initialUsers: CommunityUserRecord[];
  loadError?: string | null;
};

type UserDraft = {
  fullName: string;
  houseId: string;
  isActive: boolean;
  phone: string;
};

type StatusConfirmationState =
  | {
      mode: "save";
      nextIsActive: boolean;
      user: CommunityUserRecord;
    }
  | {
      mode: "status";
      nextIsActive: boolean;
      user: CommunityUserRecord;
    }
  | null;

const DEFAULT_VISIBLE_COUNT = 25;

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getStatusTone(isActive: boolean) {
  return isActive ? "success" : "default";
}

function getRoleTone(role: string) {
  if (role === "ADMIN") {
    return "info" as const;
  }

  if (role === "GUARD") {
    return "warning" as const;
  }

  if (role === "RESIDENT") {
    return "success" as const;
  }

  return "default" as const;
}

function getRoleLabel(role: string) {
  if (role === "UNASSIGNED") {
    return "Unassigned";
  }

  return role.charAt(0) + role.slice(1).toLowerCase();
}

function getIdentityLabel(user: CommunityUserRecord) {
  const username = user.username.trim();

  if (username) {
    return `@${username}`;
  }

  if (isSyntheticEmail(user.email)) {
    return "Sin correo";
  }

  return user.email || "Sin correo";
}

function getEmailLabel(user: CommunityUserRecord) {
  if (isSyntheticEmail(user.email)) {
    return "Sin correo";
  }

  return user.email || "Sin correo";
}

function getAuthFilterMatch(user: CommunityUserRecord, authFilter: AuthFilter) {
  switch (authFilter) {
    case "email":
      return Boolean(user.email.trim()) && !isSyntheticEmail(user.email);
    case "username":
      return Boolean(user.username.trim());
    case "synthetic":
      return isSyntheticEmail(user.email);
    default:
      return true;
  }
}

function getUserInitials(user: CommunityUserRecord) {
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "MU";
}

function createDraft(user: CommunityUserRecord): UserDraft {
  return {
    fullName: user.fullName,
    houseId: user.houseId,
    isActive: user.isActive,
    phone: user.phone,
  };
}

function updateUsersState(
  users: CommunityUserRecord[],
  nextUser: CommunityUserRecord,
) {
  return users.map((user) => (user.userId === nextUser.userId ? nextUser : user));
}

function SummaryCard({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-[26px] border border-white/8 bg-[var(--surface)] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-violet-500/18 text-white ring-1 ring-inset ring-violet-400/30"
          : "bg-white/6 text-[var(--text-muted)] ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function CommunityUsersClient({
  community,
  houses,
  initialUsers,
  loadError,
}: CommunityUsersClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [authFilter, setAuthFilter] = useState<AuthFilter>("all");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<StatusConfirmationState>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  }, [deferredQuery, roleFilter, statusFilter, authFilter]);

  useEffect(() => {
    if (!selectedUserId) {
      setIsEditMode(false);
      setDraft(null);
      setModalError(null);
      setConfirmation(null);
      return;
    }

    const selectedUser = users.find((user) => user.userId === selectedUserId);

    if (!selectedUser) {
      setSelectedUserId(null);
      setIsEditMode(false);
      setDraft(null);
      setModalError(null);
      setConfirmation(null);
      return;
    }

    setDraft(createDraft(selectedUser));
    setIsEditMode(false);
    setModalError(null);
    setConfirmation(null);
  }, [selectedUserId, users]);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !normalizedQuery ||
      user.fullName.toLowerCase().includes(normalizedQuery) ||
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.username.toLowerCase().includes(normalizedQuery) ||
      user.phone.toLowerCase().includes(normalizedQuery) ||
      user.houseLabel.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (roleFilter !== "all" && user.role !== roleFilter) {
      return false;
    }

    if (statusFilter === "active" && !user.isActive) {
      return false;
    }

    if (statusFilter === "inactive" && user.isActive) {
      return false;
    }

    return getAuthFilterMatch(user, authFilter);
  });

  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    authFilter !== "all";
  const shouldLimitResults = !hasActiveFilters && filteredUsers.length > 50;
  const visibleUsers = shouldLimitResults
    ? filteredUsers.slice(0, visibleCount)
    : filteredUsers;
  const selectedUser = selectedUserId
    ? users.find((user) => user.userId === selectedUserId) ?? null
    : null;
  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = users.length - activeCount;
  const residentCount = users.filter((user) => user.role === "RESIDENT").length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const guardCount = users.filter((user) => user.role === "GUARD").length;
  const selectedHouseRequired =
    selectedUser?.role === "RESIDENT" || selectedUser?.role === "UNASSIGNED";
  const canEditHouse = selectedUser?.role !== "GUARD";

  function closeModal() {
    if (isPending) {
      return;
    }

    setSelectedUserId(null);
  }

  function openUser(userId: string) {
    setSelectedUserId(userId);
    setPageMessage(null);
  }

  function beginEdit() {
    if (!selectedUser) {
      return;
    }

    setDraft(createDraft(selectedUser));
    setModalError(null);
    setConfirmation(null);
    setIsEditMode(true);
  }

  function syncUser(nextUser: CommunityUserRecord) {
    setUsers((current) => updateUsersState(current, nextUser));
  }

  function applyStatusChange(nextIsActive: boolean) {
    if (!selectedUser) {
      return;
    }

    setModalError(null);
    setPendingLabel(nextIsActive ? "Reactivating..." : "Deactivating...");

    startTransition(async () => {
      const result = await setCommunityUserActiveStatusAction({
        communityId: community.id,
        isActive: nextIsActive,
        userId: selectedUser.userId,
      });

      setPendingLabel(null);

      if (!result.success) {
        setModalError(result.error ?? "Could not update this user right now.");
        return;
      }

      syncUser({
        ...selectedUser,
        isActive: nextIsActive,
      });
      setConfirmation(null);
      setPageMessage(
        nextIsActive ? "User reactivated successfully." : "User deactivated successfully.",
      );
      setSelectedUserId(null);
      router.refresh();
    });
  }

  function validateDraft(currentUser: CommunityUserRecord, currentDraft: UserDraft) {
    if (!currentDraft.fullName.trim()) {
      return "Full name is required.";
    }

    if (
      (currentUser.role === "RESIDENT" || currentUser.role === "UNASSIGNED") &&
      !currentDraft.houseId.trim()
    ) {
      return `${community.unitLabel} is required for this user role.`;
    }

    return null;
  }

  function saveUser(forceDeactivate = false) {
    if (!selectedUser || !draft) {
      return;
    }

    const validationMessage = validateDraft(selectedUser, draft);

    if (validationMessage) {
      setModalError(validationMessage);
      return;
    }

    if (selectedUser.isActive && !draft.isActive && !forceDeactivate) {
      setConfirmation({
        mode: "save",
        nextIsActive: false,
        user: selectedUser,
      });
      return;
    }

    setModalError(null);
    setPendingLabel("Saving...");

    startTransition(async () => {
      const result = await updateCommunityUserAction({
        communityId: community.id,
        fullName: draft.fullName,
        houseId: draft.houseId || null,
        isActive: draft.isActive,
        phone: draft.phone,
        userId: selectedUser.userId,
      });

      setPendingLabel(null);

      if (!result.success) {
        setModalError(result.error ?? "Could not save this user right now.");
        return;
      }

      const nextHouse = houses.find((house) => house.id === draft.houseId);

      syncUser({
        ...selectedUser,
        fullName: draft.fullName.trim(),
        houseId: draft.houseId,
        houseLabel: draft.houseId
          ? (nextHouse?.label ?? selectedUser.houseLabel)
          : "No unit linked",
        isActive: draft.isActive,
        phone: draft.phone.trim(),
      });
      setConfirmation(null);
      setPageMessage("Saved successfully.");
      setSelectedUserId(null);
      router.refresh();
    });
  }

  function confirmStatusAction() {
    if (!confirmation) {
      return;
    }

    if (confirmation.mode === "save") {
      saveUser(true);
      return;
    }

    applyStatusChange(confirmation.nextIsActive);
  }

  return (
    <>
      <div className="space-y-6">
        {loadError ? (
          <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            We could not load community users right now. You can still review the community
            shell, but the user list is temporarily unavailable.
          </div>
        ) : null}

        {pageMessage ? (
          <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100">
            {pageMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="Total users" value={users.length} hint="Linked to this community" />
          <SummaryCard label="Active" value={activeCount} hint="Currently enabled" />
          <SummaryCard label="Inactive" value={inactiveCount} hint="Blocked from access" />
          <SummaryCard label="Residents" value={residentCount} hint="Resident accounts" />
          <SummaryCard label="Admins" value={adminCount} hint="Community admins" />
          <SummaryCard label="Guards" value={guardCount} hint="Guard operators" />
        </section>

        <section className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Search workspace
              </p>
              <h2 className="text-2xl font-semibold text-white">Support view for community users</h2>
              <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                Search by identity, phone, or {community.unitLabel.toLowerCase()} to move
                through this community without turning the page into a raw user dump.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-[var(--text-muted)]">
              Community scope: <span className="font-semibold text-white">{community.name}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Search
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search by name, email, username, phone, or ${community.unitLabel.toLowerCase()}...`}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/60"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Role
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "ADMIN", "RESIDENT", "GUARD", "UNASSIGNED"] as const).map((value) => (
                    <FilterButton
                      key={value}
                      active={roleFilter === value}
                      onClick={() => setRoleFilter(value)}
                    >
                      {value === "all" ? "All" : getRoleLabel(value)}
                    </FilterButton>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "active", "inactive"] as const).map((value) => (
                    <FilterButton
                      key={value}
                      active={statusFilter === value}
                      onClick={() => setStatusFilter(value)}
                    >
                      {value === "all"
                        ? "All"
                        : value.charAt(0).toUpperCase() + value.slice(1)}
                    </FilterButton>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Identity type
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All"],
                      ["email", "Email"],
                      ["username", "Username"],
                      ["synthetic", "Sin correo"],
                    ] as const
                  ).map(([value, label]) => (
                    <FilterButton
                      key={value}
                      active={authFilter === value}
                      onClick={() => setAuthFilter(value)}
                    >
                      {label}
                    </FilterButton>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(2,6,23,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {filteredUsers.length} matching user{filteredUsers.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {shouldLimitResults
                  ? `Showing ${visibleUsers.length} of ${filteredUsers.length} users`
                  : "Filtered within this community scope"}
              </p>
            </div>
          </div>

          {loadError ? (
            <div className="px-5 py-16 text-center">
              <p className="text-lg font-semibold text-white">User list unavailable.</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Please try refreshing this page in a moment.
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-lg font-semibold text-white">No users found for this community.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-lg font-semibold text-white">No users match this search.</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_120px_140px_140px_110px_110px] gap-4 border-b border-white/8 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>Name</span>
                  <span>Access identity</span>
                  <span>Role</span>
                  <span>{community.unitLabel}</span>
                  <span>Phone</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                <div className="divide-y divide-white/7">
                  {visibleUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="grid grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_120px_140px_140px_110px_110px] gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="font-semibold text-white">{user.fullName}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {user.email && !isSyntheticEmail(user.email) && user.username
                            ? user.email
                            : user.authType}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{getIdentityLabel(user)}</p>
                        <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                          {getEmailLabel(user)}
                        </p>
                      </div>
                      <div>
                        <Badge tone={getRoleTone(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </div>
                      <div className="text-sm text-[var(--text-soft)]">{user.houseLabel}</div>
                      <div className="text-sm text-[var(--text-soft)]">
                        {user.phone || "Not provided"}
                      </div>
                      <div>
                        <Badge tone={getStatusTone(user.isActive)}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <Button variant="secondary" onClick={() => openUser(user.userId)}>
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 px-4 py-4 lg:hidden">
                {visibleUsers.map((user) => (
                  <article
                    key={user.userId}
                    className="rounded-[24px] border border-white/8 bg-white/4 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{user.fullName}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {getIdentityLabel(user)}
                        </p>
                      </div>
                      <Badge tone={getStatusTone(user.isActive)}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone={getRoleTone(user.role)}>{getRoleLabel(user.role)}</Badge>
                      <Badge tone="default">{user.houseLabel}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      Phone: {user.phone || "Not provided"}
                    </p>
                    <div className="mt-4">
                      <Button variant="secondary" onClick={() => openUser(user.userId)}>
                        Manage
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              {shouldLimitResults && visibleCount < filteredUsers.length ? (
                <div className="border-t border-white/8 px-5 py-4">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setVisibleCount((current) =>
                        Math.min(current + DEFAULT_VISIBLE_COUNT, filteredUsers.length),
                      )
                    }
                  >
                    Show more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close user modal"
            className="absolute inset-0"
            onClick={closeModal}
          />

          <section className="relative z-10 w-full max-w-4xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(7,10,20,0.98))] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.5)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[linear-gradient(180deg,rgba(112,104,255,0.28),rgba(25,36,66,0.98))] text-xl font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/20">
                  {getUserInitials(selectedUser)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                    Community user
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedUser.fullName}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={getRoleTone(selectedUser.role)}>
                      {getRoleLabel(selectedUser.role)}
                    </Badge>
                    <Badge tone={getStatusTone(selectedUser.isActive)}>
                      {selectedUser.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isEditMode ? (
                  <Button variant="secondary" onClick={beginEdit}>
                    Edit user
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={closeModal} disabled={isPending}>
                  Close
                </Button>
              </div>
            </div>

            {modalError ? (
              <div className="mt-5 rounded-[22px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {modalError}
              </div>
            ) : null}

            {confirmation ? (
              <div className="mt-5 rounded-[24px] border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-base font-semibold text-white">Deactivate user?</p>
                <p className="mt-2 text-sm leading-6 text-amber-100/90">
                  This will block this user&apos;s access to ENTRY for this community. Data will
                  not be deleted.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    onClick={confirmStatusAction}
                    disabled={isPending}
                  >
                    {pendingLabel ?? "Deactivate user"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmation(null)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {!isEditMode ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Full name", selectedUser.fullName],
                  ["Email", getEmailLabel(selectedUser)],
                  ["Username", selectedUser.username ? `@${selectedUser.username}` : "Not provided"],
                  ["Phone", selectedUser.phone || "Not provided"],
                  ["Role", getRoleLabel(selectedUser.role)],
                  ["Unit", selectedUser.houseLabel],
                  ["Status", selectedUser.isActive ? "Active" : "Inactive"],
                  ["Created", formatDateTime(selectedUser.createdAt)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[22px] border border-white/8 bg-[var(--surface-strong)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {label}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            ) : draft ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Full name
                  </span>
                  <input
                    value={draft.fullName}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              fullName: event.target.value,
                            }
                          : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition focus:border-violet-400/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Phone
                  </span>
                  <input
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              phone: event.target.value,
                            }
                          : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition focus:border-violet-400/60"
                    placeholder="Phone number"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Status
                  </span>
                  <select
                    value={draft.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              isActive: event.target.value === "active",
                            }
                          : current,
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition focus:border-violet-400/60"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {community.unitLabel}
                    {selectedHouseRequired ? " *" : ""}
                  </span>
                  <select
                    value={draft.houseId}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              houseId: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={!canEditHouse}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-white outline-none transition focus:border-violet-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {canEditHouse ? `No ${community.unitLabel.toLowerCase()} linked` : "Guard users do not require a unit"}
                    </option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.label}
                        {house.isActive ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-3">
                {selectedUser.isActive ? (
                  <Button
                    variant="danger"
                    onClick={() =>
                      setConfirmation({
                        mode: "status",
                        nextIsActive: false,
                        user: selectedUser,
                      })
                    }
                    disabled={isPending}
                  >
                    {pendingLabel ?? "Deactivate user"}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => applyStatusChange(true)}
                    disabled={isPending}
                  >
                    {pendingLabel ?? "Reactivate user"}
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                {isEditMode ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsEditMode(false);
                        setDraft(createDraft(selectedUser));
                        setModalError(null);
                        setConfirmation(null);
                      }}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => saveUser()} disabled={isPending}>
                      {pendingLabel ?? "Save changes"}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={beginEdit}>
                    Manage
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
