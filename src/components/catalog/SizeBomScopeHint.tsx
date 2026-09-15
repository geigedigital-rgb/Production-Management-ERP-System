import { ALL_SIZES, type SizeScope } from "@/lib/size-bom";
import { isOversizeCode, OVERSIZE_RANGE_LABEL } from "@/lib/size-coeffs";

/**
 * Explains size tabs: shared base on «Усі», auto 3XL–6XL uplift from company %, optional overrides.
 */
export function SizeBomScopeHint({
  sizeScope,
  hasOversizeSizes,
  materialPct = 15,
  operationPct = 20,
  compact = false,
  hideUpliftPercents = false,
}: {
  sizeScope: SizeScope;
  hasOversizeSizes: boolean;
  materialPct?: number;
  operationPct?: number;
  compact?: boolean;
  /** Managers: no cost-coefficient percentages in copy. */
  hideUpliftPercents?: boolean;
}) {
  if (compact) {
    if (sizeScope === ALL_SIZES) {
      return (
        <p className="type-caption">
          База S–XL
          {hasOversizeSizes && !hideUpliftPercents
            ? ` · ${OVERSIZE_RANGE_LABEL} авто +${materialPct}% мат. / +${operationPct}% оп.`
            : hasOversizeSizes
              ? ` · ${OVERSIZE_RANGE_LABEL} окремо`
              : ""}
        </p>
      );
    }
    if (isOversizeCode(sizeScope)) {
      return (
        <p className="type-caption">
          {hideUpliftPercents
            ? `${sizeScope}: норма для цього розміру. Зміна = своя норма.`
            : `${sizeScope}: норма вже з +${materialPct}%. Зміна = своя норма розміру.`}
        </p>
      );
    }
    return (
      <p className="type-caption">Лише {sizeScope}. Решта — з «Усі».</p>
    );
  }

  if (sizeScope === ALL_SIZES) {
    return (
      <p className="type-caption">
        «Усі» — базові норми (S–XL).
        {hasOversizeSizes && !hideUpliftPercents ? (
          <>
            {" "}
            Для {OVERSIZE_RANGE_LABEL} у розрахунку автоматично матеріали +{materialPct}% і операції +
            {operationPct}% (поля справа від вкладок). Окремо оновлювати кожен виріб не потрібно.
          </>
        ) : hasOversizeSizes ? (
          <> Для {OVERSIZE_RANGE_LABEL} норми задаються окремо.</>
        ) : null}{" "}
        {!hideUpliftPercents ? "Ціна матеріалу — з каталогу." : null}
      </p>
    );
  }

  if (isOversizeCode(sizeScope)) {
    return (
      <p className="type-caption">
        {hideUpliftPercents
          ? `${sizeScope}: норма на цій вкладці — лише для цього розміру.`
          : `${sizeScope}: у полі норми вже показана база × +${materialPct}%. Змініть цифру — збережеться як своя норма цього розміру. Відсотки справа (${OVERSIZE_RANGE_LABEL}) діють на всі вироби.`}
      </p>
    );
  }

  return (
    <p className="type-caption">
      Специфікація для {sizeScope}: норма
      {!hideUpliftPercents ? " й відходи" : ""} на цій вкладці — лише для цього розміру. Решта
      лишається на базі з «Усі».
    </p>
  );
}
