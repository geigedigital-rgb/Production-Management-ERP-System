"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";

type OrderUnsavedContextValue = {
  /** Register / clear a named dirty source (multiple can be dirty at once). */
  setWorkspaceDirty: (key: string, dirty: boolean) => void;
  /**
   * Returns false when navigation should be blocked (caller must preventDefault).
   * Opens confirm dialog when dirty.
   */
  requestNavigate: (href: string) => boolean;
};

const OrderUnsavedContext = createContext<OrderUnsavedContextValue | null>(null);

export function OrderUnsavedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dirtyKeysRef = useRef(new Set<string>());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const isDirty = useCallback(() => dirtyKeysRef.current.size > 0, []);

  const setWorkspaceDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeysRef.current.add(key);
    else dirtyKeysRef.current.delete(key);
  }, []);

  const requestNavigate = useCallback(
    (href: string) => {
      if (!isDirty()) return true;
      setPendingHref(href);
      setLeaveOpen(true);
      return false;
    },
    [isDirty],
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const value = useMemo(
    () => ({ setWorkspaceDirty, requestNavigate }),
    [setWorkspaceDirty, requestNavigate],
  );

  return (
    <OrderUnsavedContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={leaveOpen}
        title="Незбережені зміни"
        description="Є незбережені зміни в комплектації. Перейти без збереження?"
        onStay={() => {
          setLeaveOpen(false);
          setPendingHref(null);
        }}
        onDiscard={() => {
          const href = pendingHref;
          dirtyKeysRef.current.clear();
          setLeaveOpen(false);
          setPendingHref(null);
          if (href) router.push(href);
        }}
      />
    </OrderUnsavedContext.Provider>
  );
}

export function useOrderUnsavedOptional() {
  return useContext(OrderUnsavedContext);
}

/** Register this component's dirty flag under a stable unique key. */
export function useOrderUnsavedWorkspaceDirty(dirty: boolean) {
  const ctx = useOrderUnsavedOptional();
  const key = useId();
  useEffect(() => {
    ctx?.setWorkspaceDirty(key, dirty);
    return () => ctx?.setWorkspaceDirty(key, false);
  }, [ctx, dirty, key]);
}
