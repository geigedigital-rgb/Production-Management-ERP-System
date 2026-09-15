"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "erp.sidebar.collapsed";
const EXPANDED = "232px";
const COLLAPSED = "56px";

type SidebarContextValue = {
  /** User preference (persisted). */
  preferredCollapsed: boolean;
  /**
   * Layout rail is narrow (preference or overlay). Stable — does not change on hover peek.
   * Used for --sidebar-width so main content / panels do not jump.
   */
  railCollapsed: boolean;
  /** Effective visual: rail collapsed and not hovering. */
  collapsed: boolean;
  /** Side panel / modal currently open. */
  overlayOpen: boolean;
  setPreferredCollapsed: (value: boolean) => void;
  toggle: () => void;
  /** Expand rail even while a side panel is open. */
  expandDespiteOverlay: () => void;
  /** Collapse again while a side panel stays open. */
  collapseDuringOverlay: () => void;
  beginHoverPeek: () => void;
  endHoverPeek: () => void;
  beginOverlay: () => void;
  endOverlay: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [preferredCollapsed, setPreferredCollapsedState] = useState(false);
  const [overlayCount, setOverlayCount] = useState(0);
  const [pinExpandedOverOverlay, setPinExpandedOverOverlay] = useState(false);
  const [hoverPeek, setHoverPeek] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setPreferredCollapsedState(true);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const overlayOpen = overlayCount > 0;

  useEffect(() => {
    if (!overlayOpen) setPinExpandedOverOverlay(false);
  }, [overlayOpen]);

  const railCollapsed = pinExpandedOverOverlay
    ? false
    : preferredCollapsed || overlayOpen;
  const collapsed = railCollapsed && !hoverPeek;

  useEffect(() => {
    if (!ready) return;
    // Layout width follows the rail preference, not hover peek — avoids content jump.
    document.documentElement.style.setProperty(
      "--sidebar-width",
      railCollapsed ? COLLAPSED : EXPANDED,
    );
    document.documentElement.dataset.sidebar = railCollapsed ? "collapsed" : "expanded";
  }, [railCollapsed, ready]);

  const setPreferredCollapsed = useCallback((value: boolean) => {
    setPreferredCollapsedState(value);
    setHoverPeek(false);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setHoverPeek(false);
    setPreferredCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const expandDespiteOverlay = useCallback(() => {
    setPinExpandedOverOverlay(true);
    setHoverPeek(false);
    setPreferredCollapsedState(false);
    try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch {
      /* ignore */
    }
  }, []);

  const collapseDuringOverlay = useCallback(() => {
    setPinExpandedOverOverlay(false);
    setHoverPeek(false);
  }, []);

  const beginHoverPeek = useCallback(() => {
    setHoverPeek(true);
  }, []);

  const endHoverPeek = useCallback(() => {
    setHoverPeek(false);
  }, []);

  const beginOverlay = useCallback(() => {
    setOverlayCount((n) => n + 1);
    setHoverPeek(false);
  }, []);

  const endOverlay = useCallback(() => {
    setOverlayCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      preferredCollapsed,
      railCollapsed,
      collapsed,
      overlayOpen,
      setPreferredCollapsed,
      toggle,
      expandDespiteOverlay,
      collapseDuringOverlay,
      beginHoverPeek,
      endHoverPeek,
      beginOverlay,
      endOverlay,
    }),
    [
      preferredCollapsed,
      railCollapsed,
      collapsed,
      overlayOpen,
      setPreferredCollapsed,
      toggle,
      expandDespiteOverlay,
      collapseDuringOverlay,
      beginHoverPeek,
      endHoverPeek,
      beginOverlay,
      endOverlay,
    ],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

/** Safe for overlays that may render outside the shell (tests / portals). */
export function useSidebarOptional() {
  return useContext(SidebarContext);
}
