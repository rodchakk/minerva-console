"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import {
  Building2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Mail,
  Pencil,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  UsersRound,
  X,
} from "lucide-react";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
import {
  getGlobalUserManagementContextAction,
  searchUsersAction,
  setCommunityUserActiveStatusAction,
  setCommunityUserUnitAction,
  updateGlobalUserIdentityAction,
  type GlobalUserHouseOption,
  type UserSearchItem,
} from "@/features/entry/users/actions";
import {
  setCommunityUserPasswordAction,
  setCommunityUserRoleAction,
} from "@/features/entry/users/communityUserActions";
import {
  ENTRY_ADMIN_TEMP_PASSWORD_HELPER,
  ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH,
} from "@/features/entry/passwordPolicy";

type ResultFilter = "all" | "RESIDENT" | "ADMIN" | "GUARD" | "inactive";
type ManageMode = "view" | "edit" | "role" | "unit" | "password" | "status";
type EditableCommunityRole = "ADMIN" | "RESIDENT";

type UserDraft = {
  fullName: string;
  phone: string;
};

function userKey(user: Pick<UserSearchItem, "communityId" | "id">) {
  return `${user.communityId}::${user.id}`;
}

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function getRoleLabel(role: string) {
  if (!role) return "Unknown";
  if (role === "UNASSIGNED") return "Unassigned";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function getIdentityLabel(user: UserSearchItem) {
  if (user.username.trim()) return `@${user.username.trim()}`;
  if (!isSyntheticEmail(user.email)) return user.email;
  return "No login identity visible";
}

function getIdentityType(user: UserSearchItem) {
  if (user.username.trim()) return "Username";
  if (!isSyntheticEmail(user.email)) return "Email";
  return "Internal account";
}

function formatDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
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
    <span className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] font-semibold ${styles}`}>
      <Icon className="size-3.5" aria-hidden />
      {getRoleLabel(role)}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] font-semibold ${
        isActive
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          : "border-rose-400/20 bg-rose-500/10 text-rose-200"
      }`}
    >
      <span className={`size-1.5 rounded-sm ${isActive ? "bg-emerald-300" : "bg-rose-300"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8F879D]">
      {children}
    </span>
  );
}

function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={entryButtonClass("primary", "min-w-[112px]")}
    >
      {pending ? "Searching..." : "Search"}
    </button>
  );
}

export function UserSearch() {
  const router = useRouter();
  const [state, formAction] = useActionState(searchUsersAction, { results: [] });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [overrides, setOverrides] = useState<
    Record<string, Partial<UserSearchItem>>
  >({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState<ManageMode>("view");
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [roleDraft, setRoleDraft] =
    useState<EditableCommunityRole>("RESIDENT");
  const [unitDraft, setUnitDraft] = useState("");
  const [houses, setHouses] = useState<GlobalUserHouseOption[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(
    () =>
      (state.results ?? []).map((user) => ({
        ...user,
        ...(overrides[userKey(user)] ?? {}),
      })),
    [overrides, state.results],
  );

  const filteredResults = useMemo(() => {
    if (filter === "all") return results;
    if (filter === "inactive") return results.filter((user) => !user.isActive);
    return results.filter((user) => user.role === filter);
  }, [filter, results]);

  const counts = useMemo(
    () => ({
      all: results.length,
      ADMIN: results.filter((user) => user.role === "ADMIN").length,
      GUARD: results.filter((user) => user.role === "GUARD").length,
      RESIDENT: results.filter((user) => user.role === "RESIDENT").length,
      inactive: results.filter((user) => !user.isActive).length,
    }),
    [results],
  );

  const selectedUser = useMemo(
    () =>
      selectedKey
        ? results.find((user) => userKey(user) === selectedKey) ?? null
        : null,
    [results, selectedKey],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !selectedKey) return;

      if (manageMode !== "view") {
        setManageMode("view");
        setError(null);
        setMessage(null);
        return;
      }

      setSelectedKey(null);
      setError(null);
      setMessage(null);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [manageMode, selectedKey]);

  useEffect(() => {
    if (selectedKey && !selectedUser) {
      setSelectedKey(null);
    }
  }, [selectedKey, selectedUser]);

  function syncUser(user: UserSearchItem, changes: Partial<UserSearchItem>) {
    setOverrides((current) => ({
      ...current,
      [userKey(user)]: {
        ...(current[userKey(user)] ?? {}),
        ...changes,
      },
    }));
  }

  function closeDrawer() {
    if (isPending) return;
    setSelectedKey(null);
    setManageMode("view");
    setMessage(null);
    setError(null);
  }

  async function openUser(user: UserSearchItem) {
    setSelectedKey(userKey(user));
    setManageMode("view");
    setDraft({ fullName: user.fullName, phone: user.phone });
    setRoleDraft(user.role === "ADMIN" ? "ADMIN" : "RESIDENT");
    setUnitDraft(user.houseId);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMessage(null);
    setError(null);
    setHouses([]);

    if (!user.communityId) return;

    setContextLoading(true);
    const context = await getGlobalUserManagementContextAction(
      user.communityId,
      user.id,
    );
    setContextLoading(false);

    if (!context.success) {
      setError(context.error ?? "Could not load community context.");
      return;
    }

    setHouses(context.houses);
  }

  function submitEdit() {
    if (!selectedUser || !draft) return;
    setError(null);
    setMessage(null);

    if (!draft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    startTransition(async () => {
      const result = await updateGlobalUserIdentityAction({
        communityId: selectedUser.communityId,
        fullName: draft.fullName,
        phone: draft.phone,
        userId: selectedUser.id,
      });

      if (!result.success) {
        setError(result.error ?? "Could not update this account.");
        return;
      }

      syncUser(selectedUser, {
        fullName: draft.fullName.trim(),
        phone: draft.phone.trim(),
      });
      setMessage("Account details updated.");
      setManageMode("view");
      router.refresh();
    });
  }

  function submitRoleChange() {
    if (!selectedUser) return;
    setError(null);
    setMessage(null);

    if (selectedUser.role !== "ADMIN" && selectedUser.role !== "RESIDENT") {
      setError("Only Resident and Admin accounts can be changed here.");
      return;
    }

    if (roleDraft === selectedUser.role) {
      setManageMode("view");
      return;
    }

    startTransition(async () => {
      const result = await setCommunityUserRoleAction({
        communityId: selectedUser.communityId,
        role: roleDraft,
        userId: selectedUser.id,
      });

      if (!result.success) {
        setError(result.error ?? "Could not change this account role.");
        return;
      }

      syncUser(selectedUser, { role: roleDraft });
      setMessage(
        roleDraft === "ADMIN"
          ? "User promoted to Admin."
          : "User changed to Resident.",
      );
      setManageMode("view");
      router.refresh();
    });
  }

  function submitUnitChange() {
    if (!selectedUser) return;
    setError(null);
    setMessage(null);

    if (!unitDraft) {
      setError("Select a unit.");
      return;
    }

    const selectedHouse = houses.find((house) => house.id === unitDraft);
    if (!selectedHouse) {
      setError("Selected unit is no longer available.");
      return;
    }

    startTransition(async () => {
      const result = await setCommunityUserUnitAction({
        communityId: selectedUser.communityId,
        houseId: unitDraft,
        userId: selectedUser.id,
      });

      if (!result.success) {
        setError(result.error ?? "Could not change this account unit.");
        return;
      }

      syncUser(selectedUser, {
        houseId: unitDraft,
        houseLabel: result.houseLabel ?? selectedHouse.label,
        isPrimary: result.isPrimary ?? false,
      });
      setMessage(`Unit changed to ${result.houseLabel ?? selectedHouse.label}.`);
      setManageMode("view");
      router.refresh();
    });
  }

  function submitPassword() {
    if (!selectedUser) return;
    setError(null);
    setMessage(null);

    if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
      setError(ENTRY_ADMIN_TEMP_PASSWORD_HELPER);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await setCommunityUserPasswordAction({
        communityId: selectedUser.communityId,
        password,
        userId: selectedUser.id,
      });

      if (!result.success) {
        setError(result.error ?? "Could not reset this password.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Password reset successfully.");
      setManageMode("view");
    });
  }

  function submitStatusChange() {
    if (!selectedUser) return;
    setError(null);
    setMessage(null);

    const nextIsActive = !selectedUser.isActive;

    startTransition(async () => {
      const result = await setCommunityUserActiveStatusAction({
        communityId: selectedUser.communityId,
        isActive: nextIsActive,
        userId: selectedUser.id,
      });

      if (!result.success) {
        setError(result.error ?? "Could not change this account status.");
        return;
      }

      syncUser(selectedUser, { isActive: nextIsActive });
      setMessage(
        nextIsActive ? "Account reactivated." : "Account deactivated.",
      );
      setManageMode("view");
      router.refresh();
    });
  }

  const hasQuery = Boolean(state.query);
  const hasResults = results.length > 0;

  return (
    <>
      <div className="space-y-3">
        <section className="relative rounded-[10px] border border-[#141119] bg-[#24202B] p-3 before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
          <form action={formAction}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">
                  Search name, email, username, phone, unit or community
                </span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                  aria-hidden
                />
                <input
                  name="query"
                  type="text"
                  defaultValue={state.query}
                  className="h-11 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-10 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
                  placeholder="Search name, email, username, phone, unit or community..."
                />
              </label>
              <SearchButton />
            </div>
            {state.message ? (
              <p className="mt-2 px-1 text-xs text-rose-300">{state.message}</p>
            ) : null}
          </form>
        </section>

        {hasResults ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ["all", "All", counts.all],
                ["RESIDENT", "Residents", counts.RESIDENT],
                ["ADMIN", "Admins", counts.ADMIN],
                ["GUARD", "Guards", counts.GUARD],
                ["inactive", "Inactive", counts.inactive],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={entryButtonClass(
                    filter === value ? "primary" : "secondary",
                    "min-w-[92px]",
                  )}
                >
                  {label}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              ))}
            </div>

            <section className="relative min-h-[420px] overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
              <div className="border-b border-[#141119] px-4 py-3">
                <h2 className="text-sm font-semibold text-white">
                  {filteredResults.length} result{filteredResults.length === 1 ? "" : "s"} for &ldquo;{state.query}&rdquo;
                </h2>
                <p className="mt-1 text-[10px] text-[#8F879D]">
                  Select a row to manage the account without leaving this workspace.
                </p>
              </div>

              <div className="overflow-auto [scrollbar-gutter:stable]">
                <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-xs">
                  <colgroup>
                    <col className="w-[27%]" />
                    <col className="w-[18%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[15%]" />
                    <col className="w-9" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                    <tr className="text-[10px] uppercase tracking-[0.13em]">
                      <th className="px-4 py-2.5 font-semibold">User</th>
                      <th className="px-4 py-2.5 font-semibold">Community</th>
                      <th className="px-4 py-2.5 font-semibold">Unit</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Last sign-in</th>
                      <th className="px-2 py-2.5"><span className="sr-only">Open details</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                    {filteredResults.map((user) => {
                      const active = selectedKey === userKey(user);

                      return (
                        <tr
                          key={userKey(user)}
                          tabIndex={0}
                          onClick={() => void openUser(user)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            void openUser(user);
                          }}
                          className={`cursor-pointer outline-none transition hover:bg-white/[0.018] ${
                            active
                              ? "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 align-top">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-[6px] border border-[rgba(117,83,255,0.20)] bg-[rgba(117,83,255,0.07)] text-[10px] font-semibold text-[#D8D1FF]">
                                {initials(user.fullName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white" title={user.fullName}>
                                  {user.fullName}
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-[#A9A3B2]">
                                  <Mail className="size-3 shrink-0" aria-hidden />
                                  <span className="truncate">{getIdentityLabel(user)}</span>
                                </p>
                                {user.phone ? (
                                  <p className="mt-0.5 text-[10px] text-[#8F879D]">{user.phone}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <p className="truncate font-semibold text-white" title={user.communityName}>
                              {user.communityName || "Unknown community"}
                            </p>
                            <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                              {user.communityCity || "No city"}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 align-top text-[#D3CEDA]">
                            <p className="truncate" title={user.houseLabel || "No unit linked"}>
                              {user.houseLabel || "No unit linked"}
                            </p>
                            {user.isPrimary ? (
                              <p className="mt-1 text-[10px] font-semibold text-[#BEB4FF]">
                                Primary resident
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <StatusBadge isActive={user.isActive} />
                          </td>
                          <td className="px-4 py-2.5 align-top text-[#D3CEDA]">
                            {formatDate(user.lastSignIn)}
                          </td>
                          <td className="px-2 py-2.5 align-middle text-right">
                            <ChevronRight className={`ml-auto size-4 ${active ? "text-[#D8D1FF]" : "text-[#8F879D]"}`} aria-hidden />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredResults.length === 0 ? (
                <div className="grid min-h-56 place-items-center px-6 text-center">
                  <div>
                    <UsersRound className="mx-auto size-8 text-[#8F879D]" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-white">
                      No accounts match this filter
                    </p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">
                      Choose another account type or search again.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {!hasResults && hasQuery ? (
          <section className="relative rounded-[10px] border border-dashed border-[#141119] bg-[#24202B] px-6 py-12 text-center before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
            <Search className="mx-auto size-8 text-[#8F879D]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-white">
              No ENTRY accounts matched &ldquo;{state.query}&rdquo;
            </p>
            <p className="mt-1 text-xs text-[#A9A3B2]">
              Search by name, email, username, phone, unit, community, role, or status.
            </p>
          </section>
        ) : null}
      </div>

      {selectedUser ? (
        <div className="pointer-events-none fixed inset-0 z-50">
          <section className="pointer-events-auto absolute bottom-5 right-5 top-[76px] flex w-[560px] flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#141119] px-4 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
                  User management
                </p>
                <h2 className="mt-1.5 truncate text-xl font-semibold tracking-[-0.02em] text-white">
                  {selectedUser.fullName}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <RoleBadge role={selectedUser.role} />
                  <StatusBadge isActive={selectedUser.isActive} />
                  {selectedUser.isPrimary ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(117,83,255,0.24)] bg-[rgba(117,83,255,0.07)] px-2 py-1 text-[11px] font-semibold text-[#D8D1FF]">
                      <Home className="size-3.5" aria-hidden />
                      Primary resident
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                disabled={isPending}
                className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
                aria-label="Close user management"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]">
              {message ? (
                <div className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-100">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-100">
                  {error}
                </div>
              ) : null}

              {manageMode === "view" ? (
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-lg border border-[#141119] bg-white/[0.012]">
                    <div className="border-b border-[#141119] px-3.5 py-3">
                      <p className="text-xs font-semibold text-white">Account details</p>
                      <p className="mt-1 text-[10px] text-[#8F879D]">
                        Identity and ENTRY context for this account.
                      </p>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      {[
                        ["Access identity", getIdentityLabel(selectedUser)],
                        ["Identity type", getIdentityType(selectedUser)],
                        ["Phone", selectedUser.phone || "Not provided"],
                        ["Role", getRoleLabel(selectedUser.role)],
                        ...(selectedUser.houseId
                          ? [[
                              "Household role",
                              selectedUser.isPrimary
                                ? "Primary resident"
                                : "Household member",
                            ]]
                          : []),
                        ["Community", selectedUser.communityName || "Unknown"],
                        ["Unit", selectedUser.houseLabel || "No unit linked"],
                        ["Last sign-in", formatDate(selectedUser.lastSignIn)],
                        ["Account created", formatDate(selectedUser.createdAt)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="grid grid-cols-[145px_minmax(0,1fr)] gap-3 px-3.5 py-3"
                        >
                          <span className="text-[11px] text-[#8F879D]">{label}</span>
                          <strong
                            className="truncate text-right text-[11px] font-semibold text-white"
                            title={value}
                          >
                            {value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[#141119] bg-white/[0.012] p-3.5">
                    <div>
                      <p className="text-xs font-semibold text-white">Account actions</p>
                      <p className="mt-1 text-[10px] text-[#8F879D]">
                        Resolve the account task without leaving the seeker.
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            fullName: selectedUser.fullName,
                            phone: selectedUser.phone,
                          });
                          setManageMode("edit");
                          setError(null);
                          setMessage(null);
                        }}
                        className={entryButtonClass("primary", "w-full justify-between px-3.5")}
                      >
                        <span className="flex items-center gap-2">
                          <Pencil className="size-3.5" aria-hidden />
                          Edit account
                        </span>
                        <ChevronRight className="size-3.5" aria-hidden />
                      </button>

                      {selectedUser.role === "ADMIN" || selectedUser.role === "RESIDENT" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRoleDraft(selectedUser.role as EditableCommunityRole);
                            setManageMode("role");
                            setError(null);
                            setMessage(null);
                          }}
                          className={entryButtonClass("secondary", "w-full justify-between px-3.5")}
                        >
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="size-3.5 text-[#BEB4FF]" aria-hidden />
                            Change role
                          </span>
                          <ChevronRight className="size-3.5 text-[#8F879D]" aria-hidden />
                        </button>
                      ) : null}

                      {selectedUser.role !== "GUARD" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUnitDraft(selectedUser.houseId);
                            setManageMode("unit");
                            setError(null);
                            setMessage(null);
                          }}
                          disabled={contextLoading || houses.length === 0}
                          className={entryButtonClass("secondary", "w-full justify-between px-3.5")}
                        >
                          <span className="flex items-center gap-2">
                            <Home className="size-3.5 text-[#BEB4FF]" aria-hidden />
                            {contextLoading ? "Loading units..." : "Change unit"}
                          </span>
                          <ChevronRight className="size-3.5 text-[#8F879D]" aria-hidden />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          setPassword("");
                          setConfirmPassword("");
                          setShowPassword(false);
                          setShowConfirmPassword(false);
                          setManageMode("password");
                          setError(null);
                          setMessage(null);
                        }}
                        className={entryButtonClass("secondary", "w-full justify-between px-3.5")}
                      >
                        <span className="flex items-center gap-2">
                          <KeyRound className="size-3.5 text-[#BEB4FF]" aria-hidden />
                          Reset password
                        </span>
                        <ChevronRight className="size-3.5 text-[#8F879D]" aria-hidden />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setManageMode("status");
                          setError(null);
                          setMessage(null);
                        }}
                        className={entryButtonClass(
                          selectedUser.isActive ? "danger" : "secondary",
                          "w-full justify-between px-3.5 sm:col-span-2",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {selectedUser.isActive ? (
                            <UserX className="size-3.5" aria-hidden />
                          ) : (
                            <UserCheck className="size-3.5 text-[#8EE2B9]" aria-hidden />
                          )}
                          {selectedUser.isActive ? "Deactivate account" : "Reactivate account"}
                        </span>
                        <ChevronRight className="size-3.5 text-[#8F879D]" aria-hidden />
                      </button>
                    </div>
                  </section>

                  <section className="rounded-lg border border-[#141119] bg-white/[0.012] p-3.5">
                    <div>
                      <p className="text-xs font-semibold text-white">Navigation</p>
                      <p className="mt-1 text-[10px] text-[#8F879D]">
                        Open the related operational workspace when deeper context is needed.
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedUser.houseId ? (
                        <Link
                          href={`/products/entry/communities/${selectedUser.communityId}/units/${selectedUser.houseId}`}
                          className={entryButtonClass("secondary", "w-full")}
                        >
                          <Home className="size-3.5 text-[#BEB4FF]" aria-hidden />
                          Open unit
                        </Link>
                      ) : null}
                      <Link
                        href={`/products/entry/communities/${selectedUser.communityId}`}
                        className={entryButtonClass("secondary", "w-full")}
                      >
                        <Building2 className="size-3.5 text-[#BEB4FF]" aria-hidden />
                        Open community
                      </Link>
                    </div>
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
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Edit account</p>
                    <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
                      Update identity details without changing role, unit, or access status.
                    </p>
                  </div>
                  <label>
                    <FieldLabel>Full name *</FieldLabel>
                    <input
                      value={draft.fullName}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, fullName: event.target.value }
                            : current,
                        )
                      }
                      className="h-10 w-full rounded-md border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#7553FF]"
                    />
                  </label>
                  <label>
                    <FieldLabel>Phone</FieldLabel>
                    <input
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, phone: event.target.value } : current,
                        )
                      }
                      className="h-10 w-full rounded-md border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#7553FF]"
                    />
                  </label>
                  <div className="flex justify-end gap-2 border-t border-[#141119] pt-4">
                    <button
                      type="button"
                      className={entryButtonClass("secondary")}
                      onClick={() => setManageMode("view")}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={entryButtonClass("primary")}
                      onClick={submitEdit}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : null}

              {manageMode === "role" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Change community role</p>
                    <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
                      Resident and Admin can be switched here. Guard accounts keep their dedicated access model.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    {([
                      ["RESIDENT", "Resident", "Standard resident access tied to the assigned unit."],
                      ["ADMIN", "Admin", "Elevated administration permissions for this community."],
                    ] as const).map(([value, label, helper]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRoleDraft(value)}
                        className={`rounded-lg border p-4 text-left transition ${
                          roleDraft === value
                            ? "border-[#7553FF] bg-[rgba(117,83,255,0.08)] shadow-[0_0_0_1px_rgba(117,83,255,0.24)]"
                            : "border-[#141119] bg-white/[0.012] hover:bg-white/[0.025]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
                            {value === "ADMIN" ? (
                              <ShieldCheck className="size-4 text-amber-300" aria-hidden />
                            ) : (
                              <Home className="size-4 text-sky-300" aria-hidden />
                            )}
                            {label}
                          </span>
                          {roleDraft === value ? (
                            <Check className="size-4 text-[#BEB4FF]" aria-hidden />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">{helper}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-[#141119] pt-4">
                    <button
                      type="button"
                      className={entryButtonClass("secondary")}
                      onClick={() => setManageMode("view")}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={entryButtonClass("primary")}
                      onClick={submitRoleChange}
                      disabled={isPending || roleDraft === selectedUser.role}
                    >
                      {isPending ? "Updating..." : "Change role"}
                    </button>
                  </div>
                </div>
              ) : null}

              {manageMode === "unit" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Change unit</p>
                    <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
                      Move this account to another unit inside {selectedUser.communityName}.
                    </p>
                  </div>

                  <label>
                    <FieldLabel>Unit *</FieldLabel>
                    <select
                      value={unitDraft}
                      onChange={(event) => setUnitDraft(event.target.value)}
                      className="h-10 w-full rounded-md border border-[#141119] bg-[#2E2936] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#7553FF]"
                    >
                      <option value="">Select unit</option>
                      {houses.map((house) => (
                        <option key={house.id} value={house.id} disabled={!house.isActive}>
                          {house.label}{house.isActive ? "" : " (inactive)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedUser.isPrimary ? (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3.5 py-3 text-xs leading-5 text-amber-100">
                      This account is currently the Primary resident. If the destination unit already has a Primary resident, this account will become a household member; otherwise the primary relationship is preserved.
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2 border-t border-[#141119] pt-4">
                    <button
                      type="button"
                      className={entryButtonClass("secondary")}
                      onClick={() => setManageMode("view")}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={entryButtonClass("primary")}
                      onClick={submitUnitChange}
                      disabled={isPending || !unitDraft || unitDraft === selectedUser.houseId}
                    >
                      {isPending ? "Moving..." : "Change unit"}
                    </button>
                  </div>
                </div>
              ) : null}

              {manageMode === "password" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-3 text-xs leading-5 text-violet-100">
                    Set a new password for {selectedUser.fullName}. The previous password will stop working immediately.
                  </div>

                  <label>
                    <FieldLabel>New password *</FieldLabel>
                    <div className="flex overflow-hidden rounded-md border border-[#141119] bg-[rgba(0,0,32,0.20)] focus-within:ring-2 focus-within:ring-[#7553FF]">
                      <input
                        autoComplete="new-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={ENTRY_ADMIN_TEMP_PASSWORD_HELPER}
                        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="grid size-10 place-items-center border-l border-[#141119] text-[#8F879D] hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </label>

                  <label>
                    <FieldLabel>Confirm password *</FieldLabel>
                    <div className="flex overflow-hidden rounded-md border border-[#141119] bg-[rgba(0,0,32,0.20)] focus-within:ring-2 focus-within:ring-[#7553FF]">
                      <input
                        autoComplete="new-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="grid size-10 place-items-center border-l border-[#141119] text-[#8F879D] hover:text-white"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </label>

                  <div className="flex justify-end gap-2 border-t border-[#141119] pt-4">
                    <button
                      type="button"
                      className={entryButtonClass("secondary")}
                      onClick={() => setManageMode("view")}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={entryButtonClass("primary")}
                      onClick={submitPassword}
                      disabled={isPending}
                    >
                      {isPending ? "Updating..." : "Reset password"}
                    </button>
                  </div>
                </div>
              ) : null}

              {manageMode === "status" ? (
                <div className="space-y-4">
                  <div
                    className={`rounded-lg border p-4 text-sm ${
                      selectedUser.isActive
                        ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                        : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    <p className="font-semibold text-white">
                      {selectedUser.isActive
                        ? `Deactivate ${selectedUser.fullName}?`
                        : `Reactivate ${selectedUser.fullName}?`}
                    </p>
                    <p className="mt-2 leading-6">
                      {selectedUser.isActive
                        ? "This blocks ENTRY access for this community. The account and unit relationship are preserved."
                        : "This restores this account access to ENTRY for this community."}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={entryButtonClass("secondary")}
                      onClick={() => setManageMode("view")}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={entryButtonClass(
                        selectedUser.isActive ? "danger" : "primary",
                      )}
                      onClick={submitStatusChange}
                      disabled={isPending}
                    >
                      {isPending
                        ? "Updating..."
                        : selectedUser.isActive
                          ? "Deactivate account"
                          : "Reactivate account"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
