"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  RotateCcw,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import {
  createCommunityDestinationAction,
  renameCommunityDestinationAction,
  setCommunityDestinationActiveAction,
  updateCommunityDestinationOrderAction,
} from "@/features/entry/communities/actions";
import type {
  CommunityDestinationPreview,
  CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import { cn } from "@/lib/supabase/utils";

type CommunityDestinationsManagerProps = {
  communityId: string;
  destinations: CommunityDestinationPreview[];
  state: CommunityDetailPreviews["destinations"]["state"];
};

type SubmitButtonProps = {
  children: string;
  disabled?: boolean;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const actionButtonBase =
  "inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-violet-300/40 disabled:cursor-not-allowed disabled:opacity-45";

const actionButtonVariants = {
  danger:
    "border-rose-400/20 bg-rose-500/10 text-rose-200 hover:border-rose-300/35 hover:bg-rose-500/15",
  ghost:
    "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-white",
  primary:
    "border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
  secondary:
    "border-[var(--border)] bg-white/[0.025] text-[var(--foreground)] hover:border-white/20 hover:bg-white/[0.05]",
};

function SubmitButton({
  children,
  disabled = false,
  pendingLabel,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(actionButtonBase, actionButtonVariants[variant])}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function IconSubmitButton({
  children,
  disabled,
  label,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-[var(--text-muted)] transition hover:border-white/12 hover:bg-white/[0.045] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/40 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

function MenuSubmitButton({
  children,
  icon,
  tone = "default",
}: {
  children: string;
  icon: ReactNode;
  tone?: "default" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-violet-300/35 disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "text-rose-200 hover:bg-rose-500/10"
          : "text-[var(--foreground)] hover:bg-white/6",
      )}
    >
      {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : icon}
      {pending ? "Updating..." : children}
    </button>
  );
}

function CreateDestinationForm({ communityId }: { communityId: string }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const canSubmit = name.trim().length > 0;

  return (
    <form
      action={createCommunityDestinationAction}
      className="pt-3"
      onSubmit={(event) => {
        if (!canSubmit) {
          event.preventDefault();
          setError("Destination name is required.");
        }
      }}
    >
      <input type="hidden" name="community_id" value={communityId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,32%)_auto] lg:items-end">
        <label className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Destination name
          </span>
          <input
            name="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            placeholder="e.g. Taller El Trancazo"
            className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm font-medium text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/70 focus:ring-2 focus:ring-violet-300/15"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Category (optional)
          </span>
          <input
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Optional category"
            className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm font-medium text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/70 focus:ring-2 focus:ring-violet-300/15"
          />
        </label>
        <SubmitButton disabled={!canSubmit} pendingLabel="Creating...">
          Create
        </SubmitButton>
      </div>
      {error ? <p className="mt-2 text-sm text-amber-200">{error}</p> : null}
    </form>
  );
}

function EmptyDestinations({ state }: { state: CommunityDestinationsManagerProps["state"] }) {
  if (state === "unavailable") {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-5 text-sm leading-6 text-[var(--text-muted)]">
        Destination catalog is not available yet. Apply the ENTRY manual access migration first.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-5">
      <p className="text-sm font-semibold text-white">No manual destinations configured yet.</p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
        Create a destination to make it available to guards.
      </p>
    </div>
  );
}

function RenameDestinationForm({
  communityId,
  destination,
  onCancel,
}: {
  communityId: string;
  destination: CommunityDestinationPreview;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(destination.name);
  const [category, setCategory] = useState(destination.category);
  const [error, setError] = useState("");
  const canSubmit = name.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form
      action={renameCommunityDestinationAction}
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_auto] lg:items-end"
      onSubmit={(event) => {
        if (!canSubmit) {
          event.preventDefault();
          setError("Destination name is required.");
        }
      }}
    >
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="destination_id" value={destination.id} />
      <label className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Destination name
        </span>
        <input
          ref={inputRef}
          name="name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          className="mt-2 h-10 w-full rounded-lg border border-violet-300/35 bg-[var(--surface)] px-3 text-sm font-medium text-white outline-none transition focus:border-violet-200 focus:ring-2 focus:ring-violet-300/10"
        />
        {error ? <span className="mt-1 block text-xs text-amber-200">{error}</span> : null}
      </label>
      <label className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Optional category
        </span>
        <input
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Optional category"
          className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/10"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={!canSubmit} pendingLabel="Saving...">
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className={cn(actionButtonBase, actionButtonVariants.ghost)}
        >
          <X aria-hidden="true" className="mr-2 h-4 w-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}

function DestinationActions({
  communityId,
  destination,
  isOpen,
  onRename,
  onToggleMenu,
}: {
  communityId: string;
  destination: CommunityDestinationPreview;
  isOpen: boolean;
  onRename: () => void;
  onToggleMenu: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for ${destination.name}`}
        onClick={onToggleMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition hover:border-white/12 hover:bg-white/[0.045] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/40"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_18px_50px_rgba(2,6,23,0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onRename}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-violet-300/35"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Rename
          </button>
          <form action={setCommunityDestinationActiveAction}>
            <input type="hidden" name="community_id" value={communityId} />
            <input type="hidden" name="destination_id" value={destination.id} />
            <input
              type="hidden"
              name="is_active"
              value={destination.isActive ? "false" : "true"}
            />
            <MenuSubmitButton
              icon={
                destination.isActive ? (
                  <Power aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                )
              }
              tone={destination.isActive ? "danger" : "default"}
            >
              {destination.isActive ? "Deactivate" : "Activate"}
            </MenuSubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function DestinationRow({
  canMoveDown,
  canMoveUp,
  communityId,
  destination,
  editingId,
  menuOpenId,
  setEditingId,
  setMenuOpenId,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  communityId: string;
  destination: CommunityDestinationPreview;
  editingId: string | null;
  menuOpenId: string | null;
  setEditingId: (id: string | null) => void;
  setMenuOpenId: (id: string | null) => void;
}) {
  const isEditing = editingId === destination.id;
  const isMenuOpen = menuOpenId === destination.id;

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        !destination.isActive && "bg-white/[0.015]",
      )}
    >
      <div className="min-w-0">
        {isEditing ? (
          <RenameDestinationForm
            communityId={communityId}
            destination={destination}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className={cn("min-w-0", !destination.isActive && "opacity-70")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-white">
                {destination.name}
              </p>
              <Badge tone={destination.isActive ? "success" : "warning"}>
                {destination.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {destination.category || "No category"} · Display order {destination.sortOrder}
            </p>
          </div>
        )}
      </div>

      {!isEditing ? (
        <div className="flex items-center gap-1.5 sm:justify-end">
          <form action={updateCommunityDestinationOrderAction}>
            <input type="hidden" name="community_id" value={communityId} />
            <input type="hidden" name="destination_id" value={destination.id} />
            <input type="hidden" name="direction" value="up" />
            <IconSubmitButton
              disabled={!canMoveUp}
              label={`Move ${destination.name} up`}
            >
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </IconSubmitButton>
          </form>
          <form action={updateCommunityDestinationOrderAction}>
            <input type="hidden" name="community_id" value={communityId} />
            <input type="hidden" name="destination_id" value={destination.id} />
            <input type="hidden" name="direction" value="down" />
            <IconSubmitButton
              disabled={!canMoveDown}
              label={`Move ${destination.name} down`}
            >
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </IconSubmitButton>
          </form>
          <DestinationActions
            communityId={communityId}
            destination={destination}
            isOpen={isMenuOpen}
            onRename={() => {
              setMenuOpenId(null);
              setEditingId(destination.id);
            }}
            onToggleMenu={() => setMenuOpenId(isMenuOpen ? null : destination.id)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function CommunityDestinationsManager({
  communityId,
  destinations,
  state,
}: CommunityDestinationsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const sortedDestinations = useMemo(
    () =>
      [...destinations].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [destinations],
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal text-white">
          Manual Access Destinations
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          Manage destinations available to guards during manual access.
        </p>
      </div>

      <CreateDestinationForm communityId={communityId} />

      <div className="my-6 border-t border-[var(--border)]" />

      <h3 className="text-base font-semibold tracking-normal text-white">Destinations</h3>

      {sortedDestinations.length === 0 ? (
        <div className="mt-4">
          <EmptyDestinations state={state} />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {sortedDestinations.map((destination, index) => (
            <DestinationRow
              key={destination.id}
              canMoveDown={index < sortedDestinations.length - 1}
              canMoveUp={index > 0}
              communityId={communityId}
              destination={destination}
              editingId={editingId}
              menuOpenId={menuOpenId}
              setEditingId={setEditingId}
              setMenuOpenId={setMenuOpenId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
