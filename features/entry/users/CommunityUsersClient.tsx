"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Filter,
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
  prepareConsoleResidentAccess,
  type PrepareConsoleResidentAccessResult,
} from "@/features/entry/activation/consoleResidentAccessActions";
import {
  ResidentAccessModePicker,
  type ResidentAccessMode,
} from "@/features/entry/activation/ResidentAccessModePicker";
import {
  setCommunityUserActiveStatusAction,
  updateCommunityUserAction,
} from "@/features/entry/users/actions";
import {
  createCommunityUserAction,
  setCommunityUserPasswordAction,
  type CommunityUserRole,
} from "@/features/entry/users/communityUserActions";
import {
  ENTRY_ADMIN_TEMP_PASSWORD_HELPER,
  ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH,
} from "@/features/entry/passwordPolicy";
import type {
  CommunityUserHouse,
  CommunityUserRecord,
  CommunityUsersPageCommunity,
} from "@/features/entry/users/queries";

type RoleFilter =
  | "all"
  | "OPERATOR"
  | "ADMIN"
  | "RESIDENT"
  | "GUARD"
  | "UNASSIGNED";
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
  accessMode: ResidentAccessMode;
  email: string;
  fullName: string;
  houseId: string;
  password: string;
  phone: string;
  role: CommunityUserRole;
  username: string;
};

const DEFAULT_VISIBLE_COUNT = 25;

const EMPTY_CREATE_DRAFT: CreateDraft = {
  accessMode: "email",
  email: "",
  fullName: "",
  houseId: "",
  password: "",
  phone: "",
  role: "RESIDENT",
  username: "",
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
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-[#8F879D]">
        <span className="grid size-7 place-items-center rounded-[6px] border border-white/[0.09] bg-white/[0.02] text-[#CFC7FF]">
          {icon}
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-[#A9A3B2]">{hint}</p>
    </>
  );

  const className = `min-h-[96px] px-4 py-3.5 text-left transition ${
    active
      ? "bg-[rgba(117,83,255,0.055)] shadow-[inset_0_-2px_0_#7553FF]"
      : "hover:bg-white/[0.015]"
  }`;

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <article className={className}>{content}</article>
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [modal, setModal] = useState<ModalState>(null);
  const [manageMode, setManageMode] = useState<ManageMode>("view");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ login: string; password: string } | null>(null);
  const [preparedAccess, setPreparedAccess] = useState<PrepareConsoleResidentAccessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const filterRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesQuery =
      !normalizedQuery ||
      user.fullName.toLowerCase().includes(normalizedQuery) ||
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.username.toLowerCase().includes(normalizedQuery) ||
      user.phone.toLowerCase().includes(normalizedQuery) ||
      user.houseLabel.toLowerCase().includes(normalizedQuery) ||
      user.role.toLowerCase().includes(normalizedQuery) ||
      getRoleLabel(user.role).toLowerCase().includes(normalizedQuery) ||
      getIdentityType(user).toLowerCase().includes(normalizedQuery) ||
      (user.isActive ? "active enabled" : "inactive disabled blocked").includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (
      roleFilter !== "all" &&
      !(
        roleFilter === "OPERATOR" &&
        (user.role === "ADMIN" || user.role === "GUARD")
      ) &&
      user.role !== roleFilter
    ) {
      return false;
    }
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
  const privilegedCount = adminCount + guardCount;
  const activeFilterCount =
    Number(roleFilter !== "all") + Number(statusFilter !== "all");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (filterOpen) {
        setFilterOpen(false);
        return;
      }

      if (modal) {
        closeModal();
      }
    }

    function onPointerDown(event: MouseEvent) {
      if (!filterOpen) return;
      const target = event.target as Node;
      if (!filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  });

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
    setShowCreatePassword(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCreatedCredentials(null);
    setPreparedAccess(null);
    setCopied(false);
    setCopiedPassword(false);
    setError(null);
  }

  function openCreate() {
    resetFeedback();
    setCreateDraft(EMPTY_CREATE_DRAFT);
    setCreatedCredentials(null);
    setPreparedAccess(null);
    setShowCreatePassword(false);
    setCopiedPassword(false);
    setModal("create");
  }

  function openManage(user: CommunityUserRecord, mode: ManageMode = "view") {
    resetFeedback();
    setSelectedUserId(user.userId);
    setDraft(buildUserDraft(user));
    setManageMode(mode);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCopiedPassword(false);
    setModal("manage");
  }

  function syncUser(nextUser: CommunityUserRecord) {
    setUsers((current) => current.map((user) => (user.userId === nextUser.userId ? nextUser : user)));
  }

  function submitCreate() {
    setError(null);
    setMessage(null);
    setPreparedAccess(null);

    if (!createDraft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    const residentUsesActivationFlow =
      createDraft.role === "RESIDENT" && createDraft.accessMode !== "quick";

    if ((createDraft.role === "RESIDENT" || createDraft.role === "ADMIN") && !createDraft.houseId) {
      setError("Select a unit for this user.");
      return;
    }

    if (residentUsesActivationFlow && createDraft.accessMode === "email" && !createDraft.email.trim()) {
      setError("Email is required for an email invitation.");
      return;
    }

    if (!residentUsesActivationFlow && createDraft.password.trim().length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
      setError(
        `Password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
      );
      return;
    }

    if (createDraft.role === "GUARD" && !createDraft.username.trim()) {
      setError("Username is required for guard accounts.");
      return;
    }

    startTransition(async () => {
      if (residentUsesActivationFlow) {
        const result = await prepareConsoleResidentAccess({
          communityId: community.id,
          unitId: createDraft.houseId,
          fullName: createDraft.fullName,
          email: createDraft.email,
          phone: createDraft.phone,
          mode: createDraft.accessMode === "email" ? "email" : "pin",
        });

        if (!result.success) {
          setError(result.error ?? "Could not prepare this resident.");
          return;
        }

        setPreparedAccess(result);
        setMessage(
          result.mode === "email"
            ? result.emailSent
              ? "Invitation sent successfully."
              : "Resident prepared for activation."
            : "Activation PIN generated.",
        );
        router.refresh();
        return;
      }

      const result = await createCommunityUserAction({
        communityId: community.id,
        email: createDraft.email,
        fullName: createDraft.fullName,
        houseId: createDraft.role === "GUARD" ? null : createDraft.houseId,
        password: createDraft.password,
        phone: createDraft.phone,
        role: createDraft.role,
        username: createDraft.role === "GUARD" ? createDraft.username : null,
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

    if (
      (selectedUser.role === "RESIDENT" ||
        selectedUser.role === "ADMIN" ||
        selectedUser.role === "UNASSIGNED") &&
      !draft.houseId
    ) {
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

    if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
      setError(
        `Password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
      );
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
      setCopiedPassword(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
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

  async function copyPreparedPin() {
    if (!preparedAccess?.pin) return;
    await navigator.clipboard.writeText(preparedAccess.pin);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyDraftPassword(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedPassword(true);
    window.setTimeout(() => setCopiedPassword(false), 1600);
  }

  return (
    <>
      <div className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 2xl:-mx-7 2xl:px-7">
        <div className="space-y-3">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
                MINERVA CONSOLE · ENTRY
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
                Users & Access
              </h1>
              <p className="mt-2 text-sm font-semibold text-white">{community.name}</p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#A9A3B2]">
                Manage login identities, roles, unit assignment, credentials, and account access for this community.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/products/entry/communities/${community.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#141119] outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
              >
                <Building2 className="size-4" aria-hidden />
                Back to community
              </Link>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create user
              </Button>
            </div>
          </header>

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

          <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<UsersRound className="size-4" />}
              label="Accounts"
              value={users.length}
              hint="All accounts linked to this community"
              active={roleFilter === "all" && statusFilter === "all"}
              onClick={() => {
                setRoleFilter("all");
                setStatusFilter("all");
                setVisibleCount(DEFAULT_VISIBLE_COUNT);
              }}
            />
            <MetricCard
              icon={<UserCheck className="size-4" />}
              label="Active access"
              value={activeCount}
              hint={inactiveCount + " inactive accounts"}
              active={statusFilter === "active" && roleFilter === "all"}
              onClick={() => {
                setRoleFilter("all");
                setStatusFilter("active");
                setVisibleCount(DEFAULT_VISIBLE_COUNT);
              }}
            />
            <MetricCard
              icon={<Home className="size-4" />}
              label="Residents"
              value={residentCount}
              hint="Resident account identities"
              active={roleFilter === "RESIDENT"}
              onClick={() => {
                setRoleFilter("RESIDENT");
                setStatusFilter("all");
                setVisibleCount(DEFAULT_VISIBLE_COUNT);
              }}
            />
            <MetricCard
              icon={<ShieldCheck className="size-4" />}
              label="Operators"
              value={privilegedCount}
              hint={adminCount + " admins · " + guardCount + " guards"}
              active={roleFilter === "OPERATOR"}
              onClick={() => {
                setRoleFilter("OPERATOR");
                setStatusFilter("all");
                setVisibleCount(DEFAULT_VISIBLE_COUNT);
              }}
            />
          </section>

          <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] xl:h-[clamp(36rem,calc(100dvh-18rem),58rem)]">
            <div className="grid gap-3 border-b border-[#141119] px-4 py-3 lg:grid-cols-[auto_minmax(340px,1fr)_auto] lg:items-center">
              <div className="min-w-[220px]">
                <h2 className="text-base font-semibold text-white">Accounts</h2>
                <p className="mt-1 text-[10px] text-[#A9A3B2]">
                  {filteredUsers.length} matching · {users.length} total
                </p>
              </div>

              <label className="relative block w-full max-w-[720px]">
                <span className="sr-only">Search users and access</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleCount(DEFAULT_VISIBLE_COUNT);
                  }}
                  placeholder="Search name, email, username, phone, unit, role or status..."
                  className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
                />
              </label>

              <div ref={filterRef} className="relative justify-self-end">
                <button
                  type="button"
                  onClick={() => setFilterOpen((value) => !value)}
                  aria-expanded={filterOpen}
                  className="inline-flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
                >
                  <Filter className="size-3.5" aria-hidden />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="grid size-4 place-items-center rounded-[4px] bg-[#7553FF] text-[9px] text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                {filterOpen ? (
                  <div className="absolute right-0 top-11 z-40 w-[320px] overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                    <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                      <div>
                        <p className="text-xs font-semibold text-white">Filter accounts</p>
                        <p className="mt-0.5 text-[10px] text-[#8F879D]">
                          Narrow by role and access status.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleFilter("all");
                          setStatusFilter("all");
                          setVisibleCount(DEFAULT_VISIBLE_COUNT);
                        }}
                        className="text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="p-2.5">
                      <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                        Role
                      </p>
                      {([
                        ["all", "All roles", users.length],
                        ["RESIDENT", "Residents", residentCount],
                        ["OPERATOR", "Operators", privilegedCount],
                        ["ADMIN", "Admins", adminCount],
                        ["GUARD", "Guards", guardCount],
                        ["UNASSIGNED", "Unassigned", users.filter((user) => user.role === "UNASSIGNED").length],
                      ] as const).map(([value, label, count]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setRoleFilter(value);
                            setVisibleCount(DEFAULT_VISIBLE_COUNT);
                          }}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                            roleFilter === value
                              ? "bg-[rgba(117,83,255,0.08)] text-white"
                              : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                          }`}
                        >
                          <span>{label}</span>
                          <span className="text-[10px] text-[#8F879D]">{count}</span>
                        </button>
                      ))}

                      <div className="my-2 border-t border-white/[0.07]" />
                      <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                        Access status
                      </p>
                      {([
                        ["all", "Any status", users.length],
                        ["active", "Active", activeCount],
                        ["inactive", "Inactive", inactiveCount],
                      ] as const).map(([value, label, count]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setStatusFilter(value);
                            setVisibleCount(DEFAULT_VISIBLE_COUNT);
                          }}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs ${
                            statusFilter === value
                              ? "bg-[rgba(117,83,255,0.08)] text-white"
                              : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white"
                          }`}
                        >
                          <span>{label}</span>
                          <span className="text-[10px] text-[#8F879D]">{count}</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setFilterOpen(false)}
                        className="mt-2 h-8 w-full rounded-md border border-[#141119] bg-[#2E2936] text-xs font-semibold text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {loadError ? (
              <div className="grid min-h-56 flex-1 place-items-center px-6 text-center text-sm text-[#A9A3B2]">
                User list unavailable.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="grid min-h-56 flex-1 place-items-center px-6 text-center">
                <div>
                  <UsersRound className="mx-auto size-8 text-[#8F879D]" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-white">No accounts match this view</p>
                  <p className="mt-1 text-xs text-[#A9A3B2]">
                    Clear the search or filters to show community accounts again.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [touch-action:pan-y]">
                  <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[22%]" />
                      <col className="w-[13%]" />
                      <col className="w-[17%]" />
                      <col className="w-[14%]" />
                      <col className="w-[9%]" />
                      <col className="w-9" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                      <tr className="text-[10px] uppercase tracking-[0.13em]">
                        <th className="px-4 py-2.5 font-semibold">User</th>
                        <th className="px-4 py-2.5 font-semibold">Access identity</th>
                        <th className="px-4 py-2.5 font-semibold">Role</th>
                        <th className="px-4 py-2.5 font-semibold">Unit</th>
                        <th className="px-4 py-2.5 font-semibold">Phone</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-2 py-2.5"><span className="sr-only">Open details</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                      {visibleUsers.map((user) => {
                        const selected = selectedUserId === user.userId && modal === "manage";
                        return (
                          <tr
                            key={user.userId}
                            tabIndex={0}
                            onClick={() => openManage(user)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              openManage(user);
                            }}
                            className={`cursor-pointer outline-none transition hover:bg-white/[0.018] ${
                              selected
                                ? "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-2.5 align-top">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-[rgba(117,83,255,0.20)] bg-[rgba(117,83,255,0.07)] text-[10px] font-semibold text-[#D8D1FF]">
                                  {getUserInitials(user)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white" title={user.fullName}>
                                    {user.fullName}
                                  </p>
                                  <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                                    {!isSyntheticEmail(user.email) ? user.email : getIdentityType(user)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 align-top">
                              <p className="truncate font-semibold text-white" title={getIdentityLabel(user)}>
                                {getIdentityLabel(user)}
                              </p>
                              <p className="mt-1 text-[10px] text-[#8F879D]">{getIdentityType(user)}</p>
                            </td>
                            <td className="px-4 py-2.5 align-top"><RoleBadge role={user.role} /></td>
                            <td className="px-4 py-2.5 align-top">
                              <p className="truncate text-[#D3CEDA]" title={user.houseLabel}>{user.houseLabel}</p>
                            </td>
                            <td className="px-4 py-2.5 align-top text-[#D3CEDA]">
                              {user.phone || "Not provided"}
                            </td>
                            <td className="px-4 py-2.5 align-top"><StatusBadge isActive={user.isActive} /></td>
                            <td className="px-2 py-2.5 align-middle text-right">
                              <ChevronRight className={`ml-auto size-4 ${selected ? "text-[#D8D1FF]" : "text-[#8F879D]"}`} aria-hidden />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#141119] bg-[#1F1B26] px-4 py-2 text-[10px] text-[#8F879D]">
                  <span>
                    Showing {visibleUsers.length} of {filteredUsers.length} matching account{filteredUsers.length === 1 ? "" : "s"}
                  </span>
                  {!hasFilters && visibleUsers.length < filteredUsers.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((current) =>
                          Math.min(current + DEFAULT_VISIBLE_COUNT, filteredUsers.length),
                        )
                      }
                      className="font-semibold text-[#BEB4FF] hover:text-white"
                    >
                      Show more
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {modal ? (
        <div
          className={
            modal === "manage"
              ? "pointer-events-none fixed inset-0 z-50"
              : "fixed inset-0 z-50 flex items-center justify-center p-4"
          }
        >
          {modal === "create" ? (
            <button
              type="button"
              aria-label="Close dialog"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeModal}
            />
          ) : null}

          <section
            className={
              modal === "manage"
                ? "pointer-events-auto absolute bottom-5 right-5 top-[76px] z-10 w-[560px] overflow-y-auto rounded-[10px] border border-[#141119] bg-[#292431] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none"
                : "relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[10px] border border-[#141119] bg-[#292431] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
            }
          >
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-4 border-b border-[#141119] bg-[#292431] px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
                  {modal === "create" ? "ENTRY user creation" : "User management"}
                </p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-white">
                  {modal === "create" ? "Create ENTRY user" : selectedUser?.fullName}
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
                className="grid size-8 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white"
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
              preparedAccess?.success ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <p className="text-sm font-semibold text-white">
                      {preparedAccess.mode === "email"
                        ? preparedAccess.emailSent
                          ? "Invitation sent"
                          : "Resident prepared"
                        : "Activation PIN ready"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {preparedAccess.residentName} · {preparedAccess.unitLabel}
                    </p>
                    {preparedAccess.mode === "email" ? (
                      <div className="mt-3 rounded-md border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Email</p>
                        <p className="mt-1 text-sm font-semibold text-white">{preparedAccess.email}</p>
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                          This resident is now tracked in Activation Queue and completes the normal ENTRY activation flow.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-md border border-violet-400/20 bg-black/15 p-3 text-center">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Activation PIN</p>
                        <p className="mt-2 font-mono text-2xl font-bold tracking-[0.24em] text-violet-100">{preparedAccess.pin}</p>
                        <Button variant="secondary" onClick={copyPreparedPin} className="mt-3">
                          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copied ? "Copied" : "Copy PIN"}
                        </Button>
                      </div>
                    )}
                    {preparedAccess.warning ? (
                      <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        {preparedAccess.warning}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={closeModal}>Done</Button>
                  </div>
                </div>
              ) : createdCredentials ? (
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
                      id="entry-community-user-full-name"
                      name="entry_community_user_full_name"
                      autoComplete="off"
                      value={createDraft.fullName}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, fullName: event.target.value }))}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  <label>
                    <FieldLabel>Role *</FieldLabel>
                    <select
                      id="entry-community-user-role"
                      name="entry_community_user_role"
                      autoComplete="off"
                      value={createDraft.role}
                      onChange={(event) => {
                        const nextRole = event.target.value as CommunityUserRole;
                        setCreateDraft((current) => ({
                          ...current,
                          email: nextRole === "GUARD" ? "" : current.email,
                          houseId: nextRole === "GUARD" ? "" : current.houseId,
                          accessMode: nextRole === "RESIDENT" ? current.accessMode : "quick",
                          role: nextRole,
                          username: nextRole === "GUARD" ? current.username : "",
                        }));
                      }}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    >
                      <option value="RESIDENT">Resident</option>
                      <option value="ADMIN">Admin</option>
                      <option value="GUARD">Guard</option>
                    </select>
                  </label>
                  <div className="sm:col-span-2">
                    <FieldLabel>Creation method</FieldLabel>
                    <ResidentAccessModePicker
                      value={createDraft.role === "RESIDENT" ? createDraft.accessMode : "quick"}
                      onChange={(accessMode) =>
                        setCreateDraft((current) => ({ ...current, accessMode }))
                      }
                      disabled={
                        createDraft.role === "RESIDENT"
                          ? undefined
                          : {
                              email: "Email invitation is currently available for resident onboarding only.",
                              pin: "Activation PIN is currently available for resident onboarding only.",
                            }
                      }
                    />
                  </div>
                  {createDraft.role === "GUARD" ? (
                    <label>
                      <FieldLabel>Username *</FieldLabel>
                      <input
                        id="entry-community-user-guard-username"
                        name="entry_community_user_guard_username"
                        autoComplete="off"
                        autoCapitalize="none"
                        value={createDraft.username}
                        onChange={(event) => setCreateDraft((current) => ({ ...current, username: event.target.value }))}
                        placeholder="guard_main"
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      />
                    </label>
                  ) : createDraft.role === "RESIDENT" && createDraft.accessMode === "pin" ? null : (
                    <label>
                      <FieldLabel>
                        {createDraft.role === "RESIDENT" && createDraft.accessMode === "email"
                          ? "Email *"
                          : "Email (optional)"}
                      </FieldLabel>
                      <input
                        id="entry-community-user-contact-email"
                        name="entry_community_user_contact_email"
                        autoComplete="off"
                        type="email"
                        value={createDraft.email}
                        onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
                        placeholder={
                          createDraft.role === "RESIDENT" && createDraft.accessMode === "email"
                            ? "resident@example.com"
                            : "Leave blank for username login"
                        }
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                      />
                    </label>
                  )}
                  <label>
                    <FieldLabel>Phone{createDraft.role === "GUARD" ? " (optional)" : ""}</FieldLabel>
                    <input
                      id="entry-community-user-contact-phone"
                      name="entry_community_user_contact_phone"
                      autoComplete="off"
                      value={createDraft.phone}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, phone: event.target.value }))}
                      className="h-10 w-full rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  {createDraft.role !== "GUARD" ? (
                    <label>
                      <FieldLabel>Unit *</FieldLabel>
                      <select
                        id="entry-community-user-unit"
                        name="entry_community_user_unit"
                        autoComplete="off"
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
                  {createDraft.role !== "RESIDENT" || createDraft.accessMode === "quick" ? (
                  <label>
                    <FieldLabel>Temporary password *</FieldLabel>
                    <div className="flex overflow-hidden rounded-md border border-white/10 bg-[var(--surface-strong)] focus-within:border-violet-400/50">
                      <input
                        id="entry-community-user-temp-password"
                        name="entry_community_user_temporary_password"
                        autoComplete="new-password"
                        type={showCreatePassword ? "text" : "password"}
                        value={createDraft.password}
                        onChange={(event) => {
                          setCreateDraft((current) => ({ ...current, password: event.target.value }));
                          setCopiedPassword(false);
                        }}
                        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
                        placeholder={ENTRY_ADMIN_TEMP_PASSWORD_HELPER}
                      />
                      <button
                        type="button"
                        title={showCreatePassword ? "Hide password" : "Show password"}
                        aria-label={showCreatePassword ? "Hide password" : "Show password"}
                        onClick={() => setShowCreatePassword((current) => !current)}
                        className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white"
                      >
                        {showCreatePassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Copy password"
                        aria-label="Copy password"
                        disabled={!createDraft.password}
                        onClick={() => copyDraftPassword(createDraft.password)}
                        className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copiedPassword ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </label>
                  ) : null}
                  <div className="sm:col-span-2 flex justify-end gap-2 border-t border-white/8 pt-4">
                    <Button variant="secondary" onClick={closeModal} disabled={isPending}>Cancel</Button>
                    <Button onClick={submitCreate} disabled={isPending}>
                      {isPending
                        ? "Working..."
                        : createDraft.role === "RESIDENT" && createDraft.accessMode === "email"
                          ? "Send invitation"
                          : createDraft.role === "RESIDENT" && createDraft.accessMode === "pin"
                            ? "Generate PIN"
                            : "Create active user"}
                    </Button>
                  </div>
                </div>
              )
            ) : selectedUser ? (
              <div className="mt-5">
                {manageMode === "view" ? (
                  <div className="space-y-4">
                    <section className="overflow-hidden rounded-lg border border-[#141119] bg-white/[0.012]">
                      <div className="border-b border-[#141119] px-3.5 py-3">
                        <p className="text-xs font-semibold text-white">Account details</p>
                        <p className="mt-1 text-[10px] text-[#8F879D]">
                          Identity and access context for this community.
                        </p>
                      </div>
                      <div className="divide-y divide-white/[0.06]">
                        {[
                          ["Access identity", getIdentityLabel(selectedUser)],
                          ["Identity type", getIdentityType(selectedUser)],
                          ["Role", getRoleLabel(selectedUser.role)],
                          ["Unit", selectedUser.houseLabel],
                          ["Phone", selectedUser.phone || "Not provided"],
                          ["Status", selectedUser.isActive ? "Active" : "Inactive"],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 px-3.5 py-3"
                          >
                            <span className="text-[11px] text-[#8F879D]">{label}</span>
                            <strong className="truncate text-right text-[11px] font-semibold text-white" title={value}>
                              {value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-[#141119] bg-white/[0.012]">
                      <div className="border-b border-[#141119] px-3.5 py-3">
                        <p className="text-xs font-semibold text-white">Account actions</p>
                        <p className="mt-1 text-[10px] text-[#8F879D]">
                          Changes here affect this user's ENTRY access.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDraft(buildUserDraft(selectedUser));
                          setManageMode("edit");
                          setError(null);
                        }}
                        className="flex w-full items-center justify-between border-b border-[#141119] px-3.5 py-3 text-left transition hover:bg-white/[0.025]"
                      >
                        <span className="flex items-center gap-2.5 text-xs font-semibold text-white">
                          <Pencil className="size-4 text-[#BEB4FF]" aria-hidden />
                          Edit account
                        </span>
                        <ChevronRight className="size-4 text-[#8F879D]" aria-hidden />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPassword("");
                          setConfirmPassword("");
                          setShowPassword(false);
                          setShowConfirmPassword(false);
                          setCopiedPassword(false);
                          setManageMode("password");
                          setError(null);
                        }}
                        className="flex w-full items-center justify-between border-b border-[#141119] px-3.5 py-3 text-left transition hover:bg-white/[0.025]"
                      >
                        <span className="flex items-center gap-2.5 text-xs font-semibold text-white">
                          <KeyRound className="size-4 text-[#BEB4FF]" aria-hidden />
                          Reset password
                        </span>
                        <ChevronRight className="size-4 text-[#8F879D]" aria-hidden />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setManageMode("status");
                          setError(null);
                        }}
                        className={`flex w-full items-center justify-between px-3.5 py-3 text-left transition hover:bg-white/[0.025] ${
                          selectedUser.isActive ? "text-[#FFB6C1]" : "text-[#8EE2B9]"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 text-xs font-semibold">
                          {selectedUser.isActive ? (
                            <UserX className="size-4" aria-hidden />
                          ) : (
                            <UserCheck className="size-4" aria-hidden />
                          )}
                          {selectedUser.isActive ? "Deactivate account" : "Reactivate account"}
                        </span>
                        <ChevronRight className="size-4 text-[#8F879D]" aria-hidden />
                      </button>
                    </section>

                    <div className="rounded-lg border border-[rgba(117,83,255,0.20)] bg-[rgba(117,83,255,0.05)] px-3.5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">
                        Access context
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#D3CEDA]">
                        {selectedUser.role === "RESIDENT"
                          ? "Resident access is tied to the assigned community unit and account activation state."
                          : selectedUser.role === "GUARD"
                            ? "Guard access is operator-level and is not tied to a residential unit."
                            : "This account has elevated community access based on its assigned role."}
                      </p>
                    </div>
                  </div>
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
                    {(selectedUser.role === "RESIDENT" || selectedUser.role === "ADMIN" || selectedUser.role === "UNASSIGNED") ? (
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
                        <div className="flex overflow-hidden rounded-md border border-white/10 bg-[var(--surface-strong)] focus-within:border-violet-400/50">
                          <input
                            id="entry-community-user-reset-password"
                            name="entry_community_user_reset_password"
                            autoComplete="new-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              setCopiedPassword(false);
                            }}
                            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                          />
                          <button
                            type="button"
                            title={showPassword ? "Hide password" : "Show password"}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((current) => !current)}
                            className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Copy password"
                            aria-label="Copy password"
                            disabled={!password}
                            onClick={() => copyDraftPassword(password)}
                            className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {copiedPassword ? (
                              <Check className="h-4 w-4" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </label>
                      <label>
                        <FieldLabel>Confirm password *</FieldLabel>
                        <div className="flex overflow-hidden rounded-md border border-white/10 bg-[var(--surface-strong)] focus-within:border-violet-400/50">
                          <input
                            id="entry-community-user-confirm-password"
                            name="entry_community_user_confirm_password"
                            autoComplete="new-password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                          />
                          <button
                            type="button"
                            title={showConfirmPassword ? "Hide password" : "Show password"}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
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
