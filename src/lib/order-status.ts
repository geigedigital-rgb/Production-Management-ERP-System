export type OrderStatus =
  | "DRAFT"
  | "CALCULATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "HANDED_TO_PRODUCTION"
  | "CLOSED"
  | "CANCELLED";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export const orderStatusLabel: Record<string, string> = {
  DRAFT: "Чернетка",
  CALCULATION: "Розрахунок",
  PENDING_APPROVAL: "На погодженні",
  APPROVED: "Погоджено",
  HANDED_TO_PRODUCTION: "У виробництві",
  CLOSED: "Закрито",
  CANCELLED: "Скасовано",
};

export const orderStatusTone: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  CALCULATION: "info",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  HANDED_TO_PRODUCTION: "accent",
  CLOSED: "neutral",
  CANCELLED: "danger",
};

/** Hover hint: what the status means and the typical next step. */
export const orderStatusHint: Record<string, string> = {
  DRAFT:
    "Замовлення щойно створене. Заповніть комплектацію (матеріали, операції) і кількості за розмірами.",
  CALCULATION:
    "Комплектацію зібрано, є або формується версія калькуляції. Наступний крок — погодити версію з ціною.",
  PENDING_APPROVAL:
    "Версія очікує рішення відповідального. Після погодження замовлення можна передати у виробництво.",
  APPROVED:
    "Ціну й склад зафіксовано. Можна передати у виробництво — специфікація заблокується для змін.",
  HANDED_TO_PRODUCTION:
    "Замовлення передано у цех. Склад і ціна зафіксовані; доступна специфікація для виробництва.",
  CLOSED:
    "Замовлення завершено. Дані збережені для історії; редагування комплектації недоступне.",
  CANCELLED:
    "Замовлення скасовано і виключено з активного пайплайну. Подальша робота по ньому не ведеться.",
};

export function orderStatusHintFor(status: string): string {
  return orderStatusHint[status] ?? "Статус замовлення в системі.";
}

/** Ordered pipeline used by the order stepper. */
export const orderPipeline: OrderStatus[] = [
  "DRAFT",
  "CALCULATION",
  "PENDING_APPROVAL",
  "APPROVED",
  "HANDED_TO_PRODUCTION",
];

