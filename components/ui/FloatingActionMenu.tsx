"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/supabase/utils";

type FloatingActionMenuProps = {
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
  open: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
};

const VIEWPORT_PADDING = 8;
const MENU_GAP = 6;

export function FloatingActionMenu({
  anchorRef,
  children,
  className,
  onClose,
  open,
}: FloatingActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;

    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const preferredLeft = anchorRect.right - menuRect.width;
    const left = Math.min(
      Math.max(preferredLeft, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, viewportWidth - menuRect.width - VIEWPORT_PADDING),
    );

    const spaceBelow = viewportHeight - anchorRect.bottom - VIEWPORT_PADDING;
    const spaceAbove = anchorRect.top - VIEWPORT_PADDING;
    const shouldOpenAbove =
      menuRect.height > spaceBelow && spaceAbove > spaceBelow;

    const preferredTop = shouldOpenAbove
      ? anchorRect.top - menuRect.height - MENU_GAP
      : anchorRect.bottom + MENU_GAP;
    const top = Math.min(
      Math.max(preferredTop, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, viewportHeight - menuRect.height - VIEWPORT_PADDING),
    );

    setPosition({ left, top });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(updatePosition);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => updatePosition());

    if (menuRef.current) {
      resizeObserver?.observe(menuRef.current);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[1000] max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] shadow-[0_18px_48px_rgba(0,0,0,0.5)]",
        className,
      )}
      style={
        position
          ? { left: position.left, top: position.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>,
    document.body,
  );
}
