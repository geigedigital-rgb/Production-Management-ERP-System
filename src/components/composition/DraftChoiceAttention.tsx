/** Inline hint for draft rows that still need a manager choice. */
export function DraftChoiceAttention({ hint }: { hint: string | null | undefined }) {
  if (!hint) return null;

  return (
    <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-text-tertiary)]" role="status">
      {hint}
    </p>
  );
}
