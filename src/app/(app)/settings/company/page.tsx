import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { PageHeader } from "@/components/ui/Page";
import { HeaderBlock } from "@/components/ui/ObjectHeader";
import { Input } from "@/components/ui/Input";
import { FormGroup, Textarea } from "@/components/ui/Field";
import { SettingsForm } from "@/components/ui/SettingsForm";
import { IconChevronRight } from "@/components/ui/Icons";
import { accessHas, getCurrentUserAccess } from "@/server/auth/access";
import { updateCompanySettingsAction } from "@/server/domains/settings/actions";

export default async function CompanySettingsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");

  const canEdit = accessHas(access, "managePricingRules");
  const company = await prisma.companySettings.findFirst().catch(() => null);

  return (
    <div>
      <PageHeader
        title="Компанія та документи"
        description="Ці дані підставляються у комерційні пропозиції та специфікації для виробництва."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <SettingsForm action={updateCompanySettingsAction} readOnly={!canEdit}>
            <FormGroup label="Реквізити" columns={1}>
              <Input
                name="legalName"
                label="Юридична назва"
                required
                defaultValue={company?.legalName ?? ""}
              />
              <Input name="address" label="Адреса" defaultValue={company?.address ?? ""} />
            </FormGroup>

            <FormGroup label="Контакти в документах" columns={2}>
              <Input name="phone" label="Телефон" defaultValue={company?.phone ?? ""} />
              <Input name="email" label="Email" type="email" defaultValue={company?.email ?? ""} />
              <Input
                name="taxId"
                label="ЄДРПОУ / ІПН"
                defaultValue={company?.taxId ?? ""}
                className="sm:col-span-2"
              />
            </FormGroup>

            <FormGroup label="Комерційна пропозиція" columns={1}>
              <Textarea
                name="quotationFooter"
                label="Текст у підвалі документа"
                defaultValue={company?.quotationFooter ?? ""}
                placeholder="Пропозиція не є публічною офертою. Остаточні умови фіксуються договором."
              />
            </FormGroup>
          </SettingsForm>
        </div>

        <HeaderBlock title="Де це використовується">
          <ul className="space-y-2 text-[13px] text-[var(--color-text-secondary)]">
            <li>
              <span className="font-medium text-[var(--color-text-primary)]">Комерційна пропозиція</span> —
              шапка з реквізитами та підвал з умовами.
            </li>
            <li>
              <span className="font-medium text-[var(--color-text-primary)]">Специфікація</span> — назва
              компанії у заголовку документа.
            </li>
          </ul>
          <Link
            href="/orders"
            className="mt-3 inline-flex items-center gap-1 border-t border-[var(--color-divider)] pt-3 text-[13px] font-medium text-[var(--color-primary-700)] hover:underline"
          >
            Переглянути документи в замовленні
            <IconChevronRight size={14} />
          </Link>
        </HeaderBlock>
      </div>
    </div>
  );
}
