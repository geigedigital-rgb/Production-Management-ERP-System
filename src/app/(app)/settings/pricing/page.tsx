import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { PageHeader } from "@/components/ui/Page";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { SettingsForm } from "@/components/ui/SettingsForm";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";
import { updatePricingSettingsAction } from "@/server/domains/settings/actions";
import { PricingPreview } from "./PricingPreview";

export default async function PricingSettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");

  const canEdit = accessHas(access, "managePricingRules");
  const pricing = await prisma.pricingSettings.findFirst().catch(() => null);

  const target = Number(pricing?.targetMarginPercent ?? 30);
  const minimum = Number(pricing?.minimumMarginPercent ?? 15);
  const method = pricing?.pricingMethod ?? "MARGIN";

  return (
    <div>
      <PageHeader
        title="Ціноутворення"
        description="Базові правила для всього проєкту. Кожне замовлення може мати свою цільову маржу — вона перекриває ці значення лише в межах цього замовлення."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start">
        <div className="space-y-4">
          <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <SettingsForm
              id="pricing-rules"
              action={updatePricingSettingsAction}
              readOnly={!canEdit}
              description="Впливає лише на нові розрахунки та активну собівартість тканин у каталозі"
            >
              <FormGroup label="Метод ціноутворення" columns={1}>
                <Select name="pricingMethod" label="Метод" defaultValue={method}>
                  <option value="MARGIN">Маржа — відсоток від ціни продажу</option>
                  <option value="MARKUP">Націнка — відсоток від собівартості</option>
                </Select>
              </FormGroup>

              <FormGroup label="Рівні прибутковості" columns={2}>
                <Input
                  name="targetMarginPercent"
                  label="Цільова ставка, %"
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  defaultValue={target}
                  hint="Базовий рівень для нових замовлень; у замовленні можна змінити"
                />
                <Input
                  name="minimumMarginPercent"
                  label="Мінімальна маржа, %"
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  defaultValue={minimum}
                  hint="Нижче — потрібне підтвердження адміністратора"
                />
              </FormGroup>

              <FormGroup label="Обмеження менеджера" columns={2}>
                <Input
                  name="managerMaxDiscountPercent"
                  label="Максимальна знижка, %"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={Number(pricing?.managerMaxDiscountPercent ?? 0)}
                />
                <Select name="roundingRule" label="Округлення" defaultValue={pricing?.roundingRule ?? "ROUND_2"}>
                  <option value="ROUND_2">До копійок (0.01)</option>
                  <option value="ROUND_1">До 0.10 ₴</option>
                  <option value="ROUND_0">До гривні</option>
                </Select>
              </FormGroup>

              <FormGroup label="Закупівля тканин (курс і карго)" columns={2}>
                <Input
                  name="usdUahRate"
                  label="Курс доллара, грн"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={Number(pricing?.usdUahRate ?? 45)}
                  hint="Для перерахунку $/кг → грн/м.п."
                />
                <Input
                  name="fabricCargoUsdPerKg"
                  label="Карго, $/кг"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={Number(pricing?.fabricCargoUsdPerKg ?? 1.7)}
                  hint="Додається до ціни $/кг (не множник)"
                />
              </FormGroup>

              <FormGroup label="ПДВ у собівартості матеріалів" columns={2}>
                <Select
                  name="materialCostVatMode"
                  label="Що йде в розрахунок виробу"
                  defaultValue={pricing?.materialCostVatMode ?? "NET"}
                >
                  <option value="NET">Без ПДВ — якщо ПДВ повертається</option>
                  <option value="GROSS">З ПДВ — повна ціна закупки</option>
                </Select>
                <Input
                  name="inputVatRatePercent"
                  label="Ставка ПДВ (довідково), %"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={Number(pricing?.inputVatRatePercent ?? 20)}
                />
              </FormGroup>
            </SettingsForm>
          </div>
        </div>

        <div className="space-y-4">
          <PricingPreview formId="pricing-rules" initial={{ method, target, minimum }} />

          <Banner tone="info" title="ПДВ у собівартості">
            У каталозі тканин зберігаються обидві ціни (з ПДВ і без). У калькуляцію виробу йде та,
            яку обрано вище. На окремій тканині можна зробити виняток. Збережені версії замовлень не
            змінюються.
          </Banner>

          <Banner tone="warning" title="Зміна правил не переписує історію">
            Погоджені версії та специфікації зберігають зафіксовані ціни. Щоб застосувати нові правила до
            замовлення, збережіть нову версію калькуляції.
          </Banner>
        </div>
      </div>
    </div>
  );
}
