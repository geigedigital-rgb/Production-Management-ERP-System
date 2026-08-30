import { cn } from "@/lib/utils";
import "./print-document.css";

export function PrintDocument({
  children,
  runningTitle,
  className,
}: {
  children: React.ReactNode;
  /** Shown at the bottom of each printed page */
  runningTitle?: string;
  className?: string;
}) {
  return (
    <article className={cn("print-doc", className)}>
      {children}
      {runningTitle ? (
        <div className="print-doc-running-footer" aria-hidden>
          {runningTitle}
        </div>
      ) : null}
    </article>
  );
}

export function PrintDocHeader({
  companyName,
  companyLines,
  docType,
  docNumber,
  docMeta,
}: {
  companyName: string;
  companyLines?: string[];
  docType: string;
  docNumber: string;
  docMeta?: string[];
}) {
  return (
    <header className="print-doc-header print-doc-section">
      <div className="print-doc-header-grid">
        <div>
          <h1 className="print-doc-company">{companyName}</h1>
          {companyLines?.length ? (
            <div className="print-doc-company-meta">
              {companyLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="print-doc-header-aside">
          <p className="print-doc-doc-type">{docType}</p>
          <p className="print-doc-doc-number">{docNumber}</p>
          {docMeta?.map((line) => (
            <p key={line} className="print-doc-doc-meta">
              {line}
            </p>
          ))}
        </div>
      </div>
    </header>
  );
}

export function PrintDocMeta({
  columns,
  cols = 2,
}: {
  columns: Array<{ label: string; content: React.ReactNode }>;
  cols?: 2 | 3;
}) {
  return (
    <section className={cn("print-doc-meta print-doc-section", cols === 3 && "print-doc-meta--3")}>
      {columns.map((col) => (
        <div key={col.label}>
          <p className="print-doc-label">{col.label}</p>
          <div className="print-doc-meta-body">{col.content}</div>
        </div>
      ))}
    </section>
  );
}

export function PrintDocSection({
  title,
  children,
  breakable = false,
}: {
  title?: string;
  children: React.ReactNode;
  breakable?: boolean;
}) {
  return (
    <section
      className={cn(
        "print-doc-section",
        breakable && "print-doc-section--breakable",
      )}
    >
      {title ? <h2 className="print-doc-section-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function PrintDocTable({
  head,
  rows,
  foot,
}: {
  head: React.ReactNode;
  rows: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="print-doc-table-wrap">
      <table className="print-doc-table">
        <thead>{head}</thead>
        <tbody>{rows}</tbody>
        {foot ? <tfoot>{foot}</tfoot> : null}
      </table>
    </div>
  );
}

export function PrintDocNotes({ title = "Примітки", children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="print-doc-section">
      <h2 className="print-doc-section-title">{title}</h2>
      <div className="print-doc-notes">{children}</div>
    </section>
  );
}

export function PrintDocFooter({ children }: { children: React.ReactNode }) {
  return <footer className="print-doc-footer print-doc-section">{children}</footer>;
}

export function PrintDocSignatures({ items }: { items: Array<{ label: string }> }) {
  return (
    <div className="print-doc-signatures">
      {items.map((item) => (
        <div key={item.label} className="print-doc-signature">
          <div className="print-doc-signature-line" />
          <p className="print-doc-signature-label">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PrintDocMuted({ children }: { children: React.ReactNode }) {
  return <p className="print-doc-meta-muted">{children}</p>;
}

export function PrintDocChip({ children }: { children: React.ReactNode }) {
  return <span className="print-doc-chip">{children}</span>;
}

export function PrintDocChips({ children }: { children: React.ReactNode }) {
  return <div className="print-doc-chips">{children}</div>;
}

export function PrintDocColumns({ children }: { children: React.ReactNode }) {
  return <div className="print-doc-columns">{children}</div>;
}
