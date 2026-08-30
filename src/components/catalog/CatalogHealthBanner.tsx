import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import type { CatalogTip } from "@/server/domains/catalog/health";

const toneBySeverity: Record<CatalogTip["severity"], "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export function CatalogHealthBanner({
  tips,
  className,
}: {
  tips: CatalogTip[];
  className?: string;
}) {
  if (tips.length === 0) return null;

  const worst = tips.some((tip) => tip.severity === "critical")
    ? "critical"
    : tips.some((tip) => tip.severity === "warning")
      ? "warning"
      : "info";

  const title =
    worst === "critical"
      ? "Потрібна увага в каталозі"
      : worst === "warning"
        ? "Рекомендації по каталогу"
        : "Підказка";

  return (
    <Banner tone={toneBySeverity[worst]} title={title} className={className}>
      <ul className="mt-1 list-disc space-y-1.5 pl-4">
        {tips.map((tip) => (
          <li key={tip.id}>
            <span className="font-medium">{tip.title}.</span> {tip.detail}
            {tip.href ? (
              <>
                {" "}
                <Link
                  href={tip.href}
                  className="font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
                >
                  {tip.hrefLabel ?? "Відкрити"}
                </Link>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Banner>
  );
}
