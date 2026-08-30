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
  /** Effective: preference or forced by overlay. */
  collapsed: boolean;
  /** Side panel / modal currently open. */
  overlayOpen: boolean;
  setPreferredCollapsed: (value: boolean) => void;
  toggle: () => void;
  beginOverlay: () => void;
  endOverlay: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [preferredCollapsed, setPreferredCollapsedState] = useState(false);
  const [overlayCount, setOverlayCount] = useState(0);
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
  const collapsed = preferredCollapsed || overlayOpen;

  useEffect(() => {
    if (!ready) return;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? COLLAPSED : EXPANDED,
    );
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  }, [collapsed, ready]);

  const setPreferredCollapsed = useCallback((value: boolean) => {
    setPreferredCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
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

  const beginOverlay = useCallback(() => {
    setOverlayCount((n) => n + 1);
  }, []);

  const endOverlay = useCallback(() => {
    setOverlayCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      preferredCollapsed,
      collapsed,
      overlayOpen,
      setPreferredCollapsed,
      toggle,
      beginOverlay,
      endOverlay,
    }),
    [
      preferredCollapsed,
      collapsed,
      overlayOpen,
      setPreferredCollapsed,
      toggle,
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
