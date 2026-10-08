"use client";

import {
  Loader2,
  GripVertical,
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
  useTransition,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
import { FloatingActionMenu } from "@/components/ui/FloatingActionMenu";
import {
  createCommunityDestinationAction,
  renameCommunityDestinationAction,
  reorderCommunityDestinationsAction,
  setCommunityDestinationActiveAction,
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
      className={entryButtonClass(variant)}
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
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#7553FF] disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "text-rose-200 hover:bg-rose-500/10"
          : "text-white hover:bg-white/6",
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
      className="border-b border-[#141119] bg-black/[0.04] p-4"
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F879D]">
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
            className="mt-2 h-10 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm font-medium text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F879D]">
            Category (optional)
          </span>
          <input
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Optional category"
            className="mt-2 h-10 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm font-medium text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
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
      <div className="rounded-lg border border-dashed border-[#141119] bg-[#2E2936] px-4 py-5 text-sm leading-6 text-[#8F879D]">
        Destination catalog is not available yet. Apply the ENTRY manual access migration first.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-[#141119] bg-[#2E2936] px-4 py-5">
      <p className="text-sm font-semibold text-white">No manual destinations configured yet.</p>
      <p className="mt-1 text-sm leading-6 text-[#8F879D]">
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F879D]">
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
          className="mt-2 h-10 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm font-medium text-white outline-none transition focus:border-[#141119] focus:ring-2 focus:ring-[#7553FF]"
        />
        {error ? <span className="mt-1 block text-xs text-amber-200">{error}</span> : null}
      </label>
      <label className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F879D]">
          Optional category
        </span>
        <input
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Optional category"
          className="mt-2 h-10 w-full rounded-md border border-[#141119] bg-[#24202B] px-3 text-sm font-medium text-white outline-none transition placeholder:text-[#8F879D] focus:border-[#141119] focus:ring-2 focus:ring-[#7553FF]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={!canSubmit} pendingLabel="Saving...">
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className={entryButtonClass("secondary")}
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for ${destination.name}`}
        onClick={onToggleMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-[#8F879D] transition hover:border-white/12 hover:bg-white/[0.045] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7553FF]"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </button>
      <FloatingActionMenu
        anchorRef={triggerRef}
        className="w-44 p-1"
        onClose={onToggleMenu}
        open={isOpen}
      >
        <button
          type="button"
          role="menuitem"
          onClick={onRename}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-[#7553FF]"
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
      </FloatingActionMenu>
    </div>
  );
}

function DestinationRow({
  communityId,
  destination,
  draggingId,
  editingId,
  isDropTarget,
  menuOpenId,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  setEditingId,
  setMenuOpenId,
}: {
  communityId: string;
  destination: CommunityDestinationPreview;
  draggingId: string | null;
  editingId: string | null;
  isDropTarget: boolean;
  menuOpenId: string | null;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, destinationId: string) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, destinationId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, destinationId: string) => void;
  setEditingId: (id: string | null) => void;
  setMenuOpenId: (id: string | null) => void;
}) {
  const isEditing = editingId === destination.id;
  const isMenuOpen = menuOpenId === destination.id;
  const isDragging = draggingId === destination.id;

  return (
    <div
      onDragOver={(event) => onDragOver(event, destination.id)}
      onDrop={(event) => onDrop(event, destination.id)}
      className={cn(
        "grid gap-3 px-4 py-3 transition sm:grid-cols-[36px_minmax(0,1fr)_180px_100px_72px] sm:items-center",
        !destination.isActive && "bg-white/[0.015]",
        isDragging && "opacity-45",
        isDropTarget &&
          !isDragging &&
          "bg-[rgba(117,83,255,0.055)] shadow-[inset_0_2px_0_#7553FF]",
      )}
    >
      {isEditing ? (
        <div className="col-span-5 min-w-0">
          <RenameDestinationForm
            communityId={communityId}
            destination={destination}
            onCancel={() => setEditingId(null)}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            draggable
            onDragStart={(event) => onDragStart(event, destination.id)}
            onDragEnd={onDragEnd}
            aria-label={`Drag to reorder ${destination.name}`}
            title="Drag to reorder"
            className="grid size-8 cursor-grab place-items-center rounded-md border border-transparent text-[#8F879D] transition hover:border-white/10 hover:bg-white/[0.035] hover:text-white active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[#7553FF]"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>

          <div className={cn("min-w-0", !destination.isActive && "opacity-70")}>
            <p className="truncate text-sm font-semibold text-white">
              {destination.name}
            </p>
            <p className="mt-1 text-[11px] text-[#8F879D]">
              Drag to change display order
            </p>
          </div>

          <div className="text-xs text-[#CFC9D6]">
            {destination.category || "No category"}
          </div>

          <div>
            <span
              className={cn(
                "inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-[11px] font-semibold",
                destination.isActive
                  ? "border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]"
                  : "border-[rgba(228,194,106,0.20)] bg-[rgba(228,194,106,0.06)] text-[#F0D995]",
              )}
            >
              {destination.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex justify-end">
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
        </>
      )}
    </div>
  );
}

export function CommunityDestinationsManager({
  communityId,
  destinations,
  state,
}: CommunityDestinationsManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isSavingOrder, startReorderTransition] = useTransition();

  const sortedDestinations = useMemo(
    () =>
      [...destinations].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [destinations],
  );
  const [orderedDestinations, setOrderedDestinations] =
    useState<CommunityDestinationPreview[]>(sortedDestinations);

  useEffect(() => {
    if (!isSavingOrder && !draggingId) {
      setOrderedDestinations(sortedDestinations);
    }
  }, [draggingId, isSavingOrder, sortedDestinations]);

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    destinationId: string,
  ) {
    setReorderError(null);
    setDraggingId(destinationId);
    setDropTargetId(destinationId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", destinationId);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    destinationId: string,
  ) {
    if (!draggingId || draggingId === destinationId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(destinationId);
  }

  function clearDragState() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    destinationId: string,
  ) {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");

    if (!sourceId || sourceId === destinationId) {
      clearDragState();
      return;
    }

    const sourceIndex = orderedDestinations.findIndex(
      (destination) => destination.id === sourceId,
    );
    const targetIndex = orderedDestinations.findIndex(
      (destination) => destination.id === destinationId,
    );

    if (sourceIndex < 0 || targetIndex < 0) {
      clearDragState();
      return;
    }

    const previousOrder = orderedDestinations;
    const nextOrder = [...orderedDestinations];
    const [moved] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    setOrderedDestinations(nextOrder);
    clearDragState();

    startReorderTransition(async () => {
      const result = await reorderCommunityDestinationsAction({
        communityId,
        orderedDestinationIds: nextOrder.map((destination) => destination.id),
      });

      if (!result.success) {
        setOrderedDestinations(previousOrder);
        setReorderError(result.error ?? "Could not save destination order.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
      <div className="flex flex-col gap-3 border-b border-[#141119] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
            Manual access destinations
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
            Destinations available to guards during manual access. Drag rows to reorder them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((value) => !value)}
          className={entryButtonClass("primary")}
        >
          {showCreateForm ? "Close form" : "+ Create destination"}
        </button>
      </div>

      {showCreateForm ? <CreateDestinationForm communityId={communityId} /> : null}

      {reorderError ? (
        <p className="border-b border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
          {reorderError}
        </p>
      ) : isSavingOrder ? (
        <p className="border-b border-[#141119] bg-[rgba(117,83,255,0.035)] px-4 py-2 text-xs text-[#BEB4FF]">
          Saving destination order…
        </p>
      ) : null}

      {orderedDestinations.length === 0 ? (
        <div className="p-4">
          <EmptyDestinations state={state} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[36px_minmax(0,1fr)_180px_100px_72px] gap-3 border-b border-[#141119] bg-[#1F1B26] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
            <span aria-hidden />
            <span>Destination</span>
            <span>Category</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[#141119]">
            {orderedDestinations.map((destination) => (
              <DestinationRow
                key={destination.id}
                communityId={communityId}
                destination={destination}
                draggingId={draggingId}
                editingId={editingId}
                isDropTarget={dropTargetId === destination.id}
                menuOpenId={menuOpenId}
                onDragEnd={clearDragState}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                setEditingId={setEditingId}
                setMenuOpenId={setMenuOpenId}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
