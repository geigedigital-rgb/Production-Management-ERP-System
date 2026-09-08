/** Small attention dot for draft rows that need a manager choice. */
export function DraftRowStatusDot({ title }: { title?: string }) {
  return (
    <span
      className="mt-[0.4rem] size-1.5 shrink-0 rounded-full bg-[var(--color-primary-500)] ring-[3px] ring-[var(--color-primary-500)]/15"
      title={title}
      aria-label={title}
      role="status"
    />
  );
}
