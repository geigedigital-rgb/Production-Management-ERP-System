"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Confirm before closing a dirty panel / form.
 * Optionally blocks browser refresh / tab close via beforeunload.
 */
export function useUnsavedCloseGuard(options: {
  dirty: boolean;
  pending?: boolean;
  /** Called when the user confirms discard (or when not dirty). */
  onDiscard: () => void;
  /** Warn on browser refresh / close. Default true when dirty. */
  blockUnload?: boolean;
}) {
  const { dirty, pending = false, onDiscard, blockUnload = true } = options;
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    if (!blockUnload || !dirty || pending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blockUnload, dirty, pending]);

  const requestClose = useCallback(() => {
    if (pending) return;
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    onDiscard();
  }, [dirty, pending, onDiscard]);

  const stay = useCallback(() => setLeaveOpen(false), []);

  const discard = useCallback(() => {
    setLeaveOpen(false);
    onDiscard();
  }, [onDiscard]);

  return { leaveOpen, requestClose, stay, discard };
}
