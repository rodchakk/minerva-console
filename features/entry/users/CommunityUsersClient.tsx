"use client";

import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Home,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  setCommunityUserActiveStatusAction,
  updateCommunityUserAction,
} from "@/features/entry/users/actions";
import {
  createCommunityUserAction,
  setCommunityUserPasswordAction,
  type CommunityUserRole,
} from "@/features/entry/users/communityUserActions";
import type {
  CommunityUserHouse,
  CommunityUserRecord,
  CommunityUsersPageCommunity,
} from "@/features/entry/users/queries";

type RoleFilter = "all" | "ADMIN" | "RESIDENT" | "GUARD" | "UNASSIGNED";
type StatusFilter = "all" | "active" | "inactive";
type ModalState = "create" | "manage" | null;
type ManageMode = "view" | "edit" | "password" | "status";

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

type CreateDraft = {
  email: string;
  fullName: string;
  houseId: string;
  password: string;
  phone: string;
  role: CommunityUserRole;
};

const DEFAULT_VISIBLE_COUNT = 25;

const EMPTY_CREATE_DRAFT: CreateDraft = {
  email: "",
  fullName: "",
  houseId: "",
  password: "",
  phone: "",
  role: "RESIDENT",
};

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function getRoleLabel(role: string) {
  if (role === "UNASSIGNED") return "Unassigned";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function getIdentityLabel(user: CommunityUserRecord) {
  if (user.username.trim()) return `@${user.username.trim()}`;
  if (!isSyntheticEmail(user.email)) return user.email;
  return "No login identity visible";
}

function getIdentityType(user: CommunityUserRecord) {
  if (user.username.trim()) return "Username";
  if (!isSyntheticEmail(user.email)) return "Email";
  return "Internal account";
}

function getUserInitials(user: CommunityUserRecord) {
  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "MU";
}

function buildUserDraft(user: CommunityUserRecord): UserDraft {
  return {
    fullName: user.fullName,
    houseId: user.houseId,
    isActive: user.isActive,
    phone: user.phone,
  };
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone?: "violet" | "green" | "orange" | "blue" | "amber" | "cyan";
}) {
  const toneClasses = {
    violet: "border-violet-400/15 bg-violet-500/10 text-violet-200",
    green: "border-emerald-400/15 bg-emerald-500/10 text-emerald-200",
    orange: "border-orange-400/15 bg-orange-500/10 text-orange-200",
    blue: "border-sky-400/15 bg-sky-500/10 text-sky-200",
    amber: "border-amber-400/15 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-400/15 bg-cyan-500/10 text-cyan-200",
  }[tone];

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_32px_rgba(2,6,23,0.18)]">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${toneClasses}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{hint}</p>
        </div>
      </div>
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
      className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-violet-400/35 bg-violet-500/18 text-white"
          : "border-white/8 bg-white/[0.035] text-[var(--text-muted)] hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles =
    role === "ADMIN"
      ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
      : role === "GUARD"
        ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
        : role === "RESIDENT"
          ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
          : "border-white/10 bg-white/5 text-slate-300";

  const Icon = role === "ADMIN" ? ShieldCheck : role === "GUARD" ? Shield : Home;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${styles}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {getRoleLabel(role)}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
        isActive
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          : "border-rose-400/20 bg-rose-500/10 text-rose-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-sm ${isActive ? "bg-emerald-300" : "bg-rose-300"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {children}
    </span>
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
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [modal, setModal] = useState<ModalState>(null);
  const [manageMode, setManageMode] = useState<ManageMode>("view");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !normalizedQuery ||
      user.fullName.toLowerCase().includes(normalizedQuery) ||
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.username.toLowerCase().includes(normalizedQuery) ||
      user.phone.toLowerCase().includes(normalizedQuery) ||
      user.houseLabel.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (statusFilter === "active" && !user.isActive) return false;
    if (statusFilter === "inactive" && user.isActive) return false;
    return true;
  });

  const hasFilters = normalizedQuery.length > 0 || roleFilter !== "all" || statusFilter !== "all";
  const visibleUsers = hasFilters ? filteredUsers : filteredUsers.slice(0, visibleCount);
  const selectedUser = selectedUserId
    ? users.find((user) => user.userId === selectedUserId) ?? null
    : null;
  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = users.length - activeCount;
  const residentCount = users.filter((user) => user.role === "RESIDENT").length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const guardCount = users.filter((user) => user.role === "GUARD").length;
  const activeHouses = houses.filter((house) => house.isActive);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function closeModal() {
    if (isPending) return;
    setModal(null);
    setManageMode("view");
    setSelectedUserId(null);
    setDraft(null);
    setCreateDraft(EMPTY_CREATE_DRAFT);
    setPassword("");
    setConfirmPassword("");
    setCreatedCredentials(null);
    setCopied(false);
    setError(null);
  }

  function openCreate() {
    resetFeedback();
    setCreateDraft(EMPTY_CREATE_DRAFT);
    setCreatedCredentials(null);
    setModal("create");
  }

  function openManage(user: CommunityUserRecord, mode: ManageMode = "view") {
    resetFeedback();
    setSelectedUserId(user.userId);
    setDraft(buildUserDraft(user));
    setManageMode(mode);
    setPassword("");
    setConfirmPassword("");
    setModal("manage");
  }

  function syncUser(nextUser: CommunityUserRecord) {
    setUsers((current) => current.map((user) => (user.userId === nextUser.userId ? nextUser : user)));
  }

  function submitCreate() {
    setError(null);

    if (!createDraft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (createDraft.password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (createDraft.role === "RESIDENT" && !createDraft.houseId) {
      setError("Select a unit for this resident.");
      return;
    }

    if ((createDraft.role === "ADMIN" || createDraft.role === "GUARD") && !createDraft.email.trim()) {
      setError("Email is required for admin and guard accounts.");
      return;
    }

    startTransition(async () => {
      const result = await createCommunityUserAction({
        communityId: community.id,
        email: createDraft.email,
        fullName: createDraft.fullName,
        houseId: createDraft.role === "RESIDENT" ? createDraft.houseId : null,
        password: createDraft.password,
        phone: createDraft.phone,
        role: createDraft.role,
      });

      if (!result.success) {
        setError(result.error ?? "Could not create this user.");
        return;
      }

      setCreatedCredentials(result.credentials ?? null);
      setMessage("User created successfully.");
      router.refresh();
    });
  }

  function submitEdit() {
    if (!selectedUser || !draft) return;
    setError(null);

    if (!draft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if ((selectedUser.role === "RESIDENT" || selectedUser.role === "UNASSIGNED") && !draft.houseId) {
      setError("Unit is required for this user role.");
      return;
    }

    startTransition(async () => {
      const result = await updateCommunityUserAction({
        communityId: community.id,
        fullName: draft.fullName,
        houseId: draft.houseId || null,
        isActive: draft.isActive,
        phone: draft.phone,
        userId: selectedUser.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not save this user.");
        return;
      }

      const house = houses.find((item) => item.id === draft.houseId);
      syncUser({
        ...selectedUser,
        fullName: draft.fullName.trim(),
        houseId: draft.houseId,
        houseLabel: draft.houseId ? house?.label ?? selectedUser.houseLabel : "No unit linked",
        isActive: draft.isActive,
        phone: draft.phone.trim(),
      });
      setMessage("User updated successfully.");
      setManageMode("view");
      router.refresh();
    });
  }

  function submitStatusChange() {
    if (!selectedUser) return;
    setError(null);
    const nextIsActive = !selectedUser.isActive;

    startTransition(async () => {
      const result = await setCommunityUserActiveStatusAction({
        communityId: community.id,
        isActive: nextIsActive,
        userId: selectedUser.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not change this user status.");
        return;
      }

      syncUser({ ...selectedUser, isActive: nextIsActive });
      setMessage(nextIsActive ? "User reactivated successfully." : "User deactivated successfully.");
      setManageMode("view");
      router.refresh();
    });
  }

  function submitPassword() {
    if (!selectedUser) return;
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await setCommunityUserPasswordAction({
        communityId: community.id,
        password,
        userId: selectedUser.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not reset this password.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
      setManageMode("view");
    });
  }

  async function copyCredentials() {
    if (!createdCredentials) return;
    await navigator.clipboard.writeText(
      `Login: ${createdCredentials.login}\nPassword: ${createdCredentials.password}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <div className="space-y-5">
        <section className="flex flex-col gap-5 pt-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                MINERVA CONSOLE / ENTRY
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Community users</h1>
              <p className="mt-1 text-sm font-semibold text-violet-100">{community.name}</p>
              <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
                Manage residents, admins, and guards for this community.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">
                <Building2 className="mr-2 h-4 w-4" aria-hidden />
                Community detail
              </Button>
            </Link>
            <Link href="/products/entry/communities">
              <Button variant="secondary">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Back to communities
              </Button>
            </Link>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Create user
            </Button>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Community users are temporarily unavailable. Please refresh and try again.
          </div>
        ) : null}

        {message && !modal ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard icon={<UsersRound className="h-5 w-5" />} label="Total users" value={users.length} hint="Linked to community" />
          <MetricCard icon={<UserCheck className="h-5 w-5" />} label="Active" value={activeCount} hint="Currently enabled" tone="green" />
          <MetricCard icon={<UserX className="h-5 w-5" />} label="Inactive" value={inactiveCount} hint="Blocked from access" tone="orange" />
          <MetricCard icon={<Home className="h-5 w-5" />} label="Residents" value={residentCount} hint="Resident accounts" tone="blue" />
          <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Admins" value={adminCount} hint="Community admins" tone="amber" />
          <MetricCard icon={<Shield className="h-5 w-5" />} label="Guards" value={guardCount} hint="Guard operators" tone="cyan" />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_36px_rgba(2,6,23,0.18)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <FieldLabel>Search users</FieldLabel>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleCount(DEFAULT_VISIBLE_COUNT);
                  }}
                  placeholder="Search name, email, username, phone, or unit..."
                  className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/50"
                />
              </div>
            </label>

            <div>
              <FieldLabel>Role</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "ADMIN", "RESIDENT", "GUARD", "UNASSIGNED"] as const).map((value) => (
                  <FilterButton
                    key={value}
                    active={roleFilter === value}
                    onClick={() => {
                      setRoleFilter(value);
                      setVisibleCount(DEFAULT_VISIBLE_COUNT);
                    }}
                  >
                    {value === "all" ? "All" : getRoleLabel(value)}
                  </FilterButton>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <div className="flex gap-1.5">
                {(["all", "active", "inactive"] as const).map((value) => (
                  <FilterButton
                    key={value}
                    active={statusFilter === value}
                    onClick={() => {
                      setStatusFilter(value);
                      setVisibleCount(DEFAULT_VISIBLE_COUNT);
                    }}
                  >
                    {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
                  </FilterButton>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_36px_rgba(2,6,23,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {hasFilters || filteredUsers.length <= DEFAULT_VISIBLE_COUNT
                  ? "Filtered within this community"
                  : `Showing ${visibleUsers.length} of ${filteredUsers.length}`}
              </p>
            </div>
          </div>

          {loadError ? (
            <div className="px-5 py-14 text-center text-sm text-[var(--text-muted)]">User list unavailable.</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden />
              <p className="mt-3 font-semibold text-white">No users match these filters.</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Try a different search, role, or status.</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <div className="grid grid-cols-[minmax(210px,1.3fr)_minmax(185px,1fr)_125px_minmax(110px,0.7fr)_125px_100px_100px] gap-3 border-b border-white/8 bg-white/[0.018] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <span>Name</span>
                  <span>Access identity</span>
                  <span>Role</span>
                  <span>Unit</span>
                  <span>Phone</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {visibleUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="grid grid-cols-[minmax(210px,1.3fr)_minmax(185px,1fr)_125px_minmax(110px,0.7fr)_125px_100px_100px] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.025]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-xs font-semibold text-violet-100">
                          {getUserInitials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {!isSyntheticEmail(user.email) ? user.email : getIdentityType(user)}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {user.username ? (
                            <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                          ) : (
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                          )}
                          <p className="truncate text-sm font-semibold text-slate-100">{getIdentityLabel(user)}</p>
                        </div>
                        <p className="ml-6 mt-0.5 text-xs text-[var(--text-muted)]">{getIdentityType(user)}</p>
                      </div>

                      <div><RoleBadge role={user.role} /></div>
                      <div className="truncate text-sm text-[var(--text-soft)]">{user.houseLabel}</div>
                      <div className="truncate text-sm text-[var(--text-soft)]">{user.phone || "Not provided"}</div>
                      <div><StatusBadge isActive={user.isActive} /></div>
                      <div className="text-right">
                        <Button variant="secondary" onClick={() => openManage(user)}>
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 p-3 lg:hidden">
                {visibleUsers.map((user) => (
                  <article key={user.userId} className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-xs font-semibold text-violet-100">
                          {getUserInitials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{user.fullName}</p>
                          <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{getIdentityLabel(user)}</p>
                        </div>
                      </div>
                      <StatusBadge isActive={user.isActive} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <RoleBadge role={user.role} />
                      <span className="rounded-md border border-white/8 bg-white/[0.035] px-2 py-1 text-xs text-[var(--text-muted)]">
                        {user.houseLabel}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="secondary" onClick={() => openManage(user)}>Manage</Button>
                    </div>
                  </article>
                ))}
              </div>

              {!hasFilters && visibleUsers.length < filteredUsers.length ? (
                <div className="border-t border-white/8 px-4 py-3">
                  <Button
                    variant="secondary"
                    onClick={() => setVisibleCount((current) => Math.min(current + DEFAULT_VISIBLE_COUNT, filteredUsers.length))}
                  >
                    Show more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          <section className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                  {modal === "create" ? "New community user" : "User management"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {modal === "create" ? "Create user" : selectedUser?.fullName}
                </h2>
                {modal === "manage" && selectedUser ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <RoleBadge role={selectedUser.role} />
                    <StatusBadge isActive={selectedUser.isActive} />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-[var(--text-muted)] transition hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {message ? (
              <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            {modal === "create" ? (
              createdCredentials ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-violet-400/20 bg-violet-500/8 p-4">
                    <p className="text-sm font-semibold text-white">Credentials</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Login</p>
                        <p className="mt-1 font-mono text-sm text-white">{createdCredentials.login}</p>
                      </div>
                      <div className="rounded-md border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Password</p>
                        <p className="mt-1 font-mono text-sm text-white">{createdCredentials.password}</p>
                      </div>
                    </div>
                    <Button variant="secondary" onClick={copyCredentials} className="mt-3">
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? "Copied" : "Copy credentials"}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={closeModal}>Done</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label>
                    <FieldLabel>Full name *</FieldLabel>
                    <input
                      value={createDraft.fullName}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, fullName: event.target.value }))}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  <label>
                    <FieldLabel>Role *</FieldLabel>
                    <select
                      value={createDraft.role}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          role: event.target.value as CommunityUserRole,
                          houseId: event.target.value === "RESIDENT" ? current.houseId : "",
                        }))
                      }
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    >
                      <option value="RESIDENT">Resident</option>
                      <option value="ADMIN">Admin</option>
                      <option value="GUARD">Guard</option>
                    </select>
                  </label>
                  <label>
                    <FieldLabel>{createDraft.role === "RESIDENT" ? "Email (optional)" : "Email *"}</FieldLabel>
                    <input
                      type="email"
                      value={createDraft.email}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
                      placeholder={createDraft.role === "RESIDENT" ? "Leave blank for username login" : "name@example.com"}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  <label>
                    <FieldLabel>Phone</FieldLabel>
                    <input
                      value={createDraft.phone}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, phone: event.target.value }))}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  {createDraft.role === "RESIDENT" ? (
                    <label>
                      <FieldLabel>Unit *</FieldLabel>
                      <select
                        value={createDraft.houseId}
                        onChange={(event) => setCreateDraft((current) => ({ ...current, houseId: event.target.value }))}
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      >
                        <option value="">Select unit</option>
                        {activeHouses.map((house) => (
                          <option key={house.id} value={house.id}>{house.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <FieldLabel>Password *</FieldLabel>
                    <input
                      type="password"
                      value={createDraft.password}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      placeholder="Minimum 8 characters"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end gap-2 border-t border-white/8 pt-4">
                    <Button variant="secondary" onClick={closeModal} disabled={isPending}>Cancel</Button>
                    <Button onClick={submitCreate} disabled={isPending}>{isPending ? "Creating..." : "Create user"}</Button>
                  </div>
                </div>
              )
            ) : selectedUser ? (
              <div className="mt-5">
                {manageMode === "view" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Access identity", getIdentityLabel(selectedUser)],
                        ["Role", getRoleLabel(selectedUser.role)],
                        ["Unit", selectedUser.houseLabel],
                        ["Phone", selectedUser.phone || "Not provided"],
                        ["Status", selectedUser.isActive ? "Active" : "Inactive"],
                        ["Identity type", getIdentityType(selectedUser)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
                          <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => { setDraft(buildUserDraft(selectedUser)); setManageMode("edit"); setError(null); }}
                        className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3 text-left text-sm font-semibold text-white transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
                      >
                        <Pencil className="h-4 w-4 text-violet-200" /> Edit user
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPassword(""); setConfirmPassword(""); setManageMode("password"); setError(null); }}
                        className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-3 text-left text-sm font-semibold text-white transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
                      >
                        <KeyRound className="h-4 w-4 text-violet-200" /> Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => { setManageMode("status"); setError(null); }}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm font-semibold transition ${
                          selectedUser.isActive
                            ? "border-rose-400/15 bg-rose-500/[0.06] text-rose-100 hover:border-rose-400/30"
                            : "border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-100 hover:border-emerald-400/30"
                        }`}
                      >
                        {selectedUser.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {selectedUser.isActive ? "Deactivate user" : "Reactivate user"}
                      </button>
                    </div>
                  </>
                ) : null}

                {manageMode === "edit" && draft ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <FieldLabel>Full name *</FieldLabel>
                      <input
                        value={draft.fullName}
                        onChange={(event) => setDraft((current) => current ? { ...current, fullName: event.target.value } : current)}
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      />
                    </label>
                    <label>
                      <FieldLabel>Phone</FieldLabel>
                      <input
                        value={draft.phone}
                        onChange={(event) => setDraft((current) => current ? { ...current, phone: event.target.value } : current)}
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      />
                    </label>
                    {(selectedUser.role === "RESIDENT" || selectedUser.role === "UNASSIGNED") ? (
                      <label>
                        <FieldLabel>Unit *</FieldLabel>
                        <select
                          value={draft.houseId}
                          onChange={(event) => setDraft((current) => current ? { ...current, houseId: event.target.value } : current)}
                          className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                        >
                          <option value="">Select unit</option>
                          {houses.map((house) => (
                            <option key={house.id} value={house.id}>{house.label}{house.isActive ? "" : " (inactive)"}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      <FieldLabel>Status</FieldLabel>
                      <select
                        value={draft.isActive ? "active" : "inactive"}
                        onChange={(event) => setDraft((current) => current ? { ...current, isActive: event.target.value === "active" } : current)}
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <div className="sm:col-span-2 flex justify-end gap-2 border-t border-white/8 pt-4">
                      <Button variant="secondary" onClick={() => setManageMode("view")} disabled={isPending}>Cancel</Button>
                      <Button onClick={submitEdit} disabled={isPending}>{isPending ? "Saving..." : "Save changes"}</Button>
                    </div>
                  </div>
                ) : null}

                {manageMode === "password" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-3 text-sm text-violet-100">
                      Set a new password for {selectedUser.fullName}. The previous password will stop working immediately.
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <FieldLabel>New password *</FieldLabel>
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50" />
                      </label>
                      <label>
                        <FieldLabel>Confirm password *</FieldLabel>
                        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50" />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-white/8 pt-4">
                      <Button variant="secondary" onClick={() => setManageMode("view")} disabled={isPending}>Cancel</Button>
                      <Button onClick={submitPassword} disabled={isPending}>{isPending ? "Updating..." : "Reset password"}</Button>
                    </div>
                  </div>
                ) : null}

                {manageMode === "status" ? (
                  <div>
                    <div className={`rounded-lg border p-4 text-sm ${selectedUser.isActive ? "border-rose-400/20 bg-rose-500/10 text-rose-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>
                      <p className="font-semibold text-white">
                        {selectedUser.isActive ? `Deactivate ${selectedUser.fullName}?` : `Reactivate ${selectedUser.fullName}?`}
                      </p>
                      <p className="mt-2 leading-6">
                        {selectedUser.isActive
                          ? "This blocks access to ENTRY for this community. The user record and unit relationship are preserved."
                          : "This restores this user account access to ENTRY for this community."}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setManageMode("view")} disabled={isPending}>Cancel</Button>
                      <Button variant={selectedUser.isActive ? "danger" : "primary"} onClick={submitStatusChange} disabled={isPending}>
                        {isPending ? "Updating..." : selectedUser.isActive ? "Deactivate user" : "Reactivate user"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
