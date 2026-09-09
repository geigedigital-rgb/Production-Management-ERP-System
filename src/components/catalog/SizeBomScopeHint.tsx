import { ALL_SIZES, type SizeScope } from "@/lib/size-bom";
import { isOversizeCode } from "@/lib/size-coeffs";

/**
 * Explains size tabs: shared base on «Усі», auto XXL+ uplift from company %, optional overrides.
 */
export function SizeBomScopeHint({
  sizeScope,
  hasOversizeSizes,
  materialPct = 15,
  operationPct = 20,
  compact = false,
}: {
  sizeScope: SizeScope;
  hasOversizeSizes: boolean;
  materialPct?: number;
  operationPct?: number;
  compact?: boolean;
}) {
  if (compact) {
    if (sizeScope === ALL_SIZES) {
      return (
        <p className="type-caption">
          База S–XL
          {hasOversizeSizes
            ? ` · XXL+ авто +${materialPct}% мат. / +${operationPct}% оп.`
            : ""}
        </p>
      );
    }
    if (isOversizeCode(sizeScope)) {
      return (
        <p className="type-caption">
          {sizeScope}: норма вже з +{materialPct}%. Зміна = своя норма розміру.
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
        {hasOversizeSizes ? (
          <>
            {" "}
            Для XXL / 3XL / 4XL у розрахунку автоматично матеріали +{materialPct}% і операції +
            {operationPct}% (поля справа від вкладок). Окремо оновлювати кожен виріб не потрібно.
          </>
        ) : null}{" "}
        Ціна матеріалу — з каталогу.
      </p>
    );
  }

  if (isOversizeCode(sizeScope)) {
    return (
      <p className="type-caption">
        {sizeScope}: у полі норми вже показана база × +{materialPct}%. Змініть цифру — збережеться
        як своя норма цього розміру. Відсотки справа діють на всі вироби.
      </p>
    );
  }

  return (
    <p className="type-caption">
      Специфікація для {sizeScope}: норма й відходи на цій вкладці — лише для цього розміру. Решта
      лишається на базі з «Усі».
    </p>
  );
}
