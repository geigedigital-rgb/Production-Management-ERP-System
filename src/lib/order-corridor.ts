export type CorridorKey =
  | "compose"
  | "saveVersion"
  | "approve"
  | "artwork"
  | "handover"
  | "spec"
  | "closed"
  | "cancelled";

export type CorridorTab = "configuration" | "calculation" | "versions" | "files";

export type ItemNeed = "qty" | "compose" | "saveVersion" | "approve" | "ready";

export type CorridorStep = {
  key: CorridorKey;
  /** 1-based index in the live corridor (compose → spec). */
  index: number;
  of: number;
  label: string;
  title: string;
  detail: string;
  tab: CorridorTab;
  hrefQuery?: string;
  /** Line that currently blocks the next step (multi-item orders). */
  focusItemId?: string;
  /** Document shortcuts that actually work in this state. */
  quotationReady: boolean;
  specificationReady: boolean;
};

export type CorridorItemFacts = {
  id: string;
  nameUk: string;
  totalQuantity: number;
  materialsCount: number;
  operationsCount: number;
  decorationsCount: number;
  versionCount: number;
  hasApprovedVersion: boolean;
  specificationLocked: boolean;
  inLatestProposal?: boolean;
};

export type CorridorFacts = {
  status: string;
  deadline: Date | string | null;
  filesCount: number;
  items: CorridorItemFacts[];
  hasCompleteProposal?: boolean;
  hasApprovedProposal?: boolean;
};

const LIVE_STEPS = 5;

export const itemNeedLabel: Record<ItemNeed, string> = {
  qty: "Вкажіть кількість",
  compose: "Зберіть склад",
  saveVersion: "Збережіть пропозицію",
  approve: "Погодьте пропозицію",
  ready: "Погоджено",
};

export function itemNeed(item: CorridorItemFacts, order?: Pick<CorridorFacts, "hasCompleteProposal" | "hasApprovedProposal">): ItemNeed {
  if (item.totalQuantity <= 0) return "qty";
  if (item.materialsCount <= 0 || item.operationsCount <= 0) return "compose";
  if (order && !order.hasCompleteProposal) return "saveVersion";
  if (order && order.hasCompleteProposal && !order.hasApprovedProposal) return "approve";
  if (!item.hasApprovedVersion) return "approve";
  return "ready";
}

export function itemNeedTone(
  need: ItemNeed,
): "neutral" | "accent" | "success" | "warning" | "info" {
  if (need === "ready") return "success";
  if (need === "approve") return "warning";
  if (need === "saveVersion") return "info";
  return "accent";
}

function firstBlocking(items: CorridorItemFacts[], order?: Pick<CorridorFacts, "hasCompleteProposal" | "hasApprovedProposal">) {
  return items.find((item) => itemNeed(item, order) !== "ready") ?? null;
}

function named(item: CorridorItemFacts | null, many: boolean, fallback: string) {
  if (!item || !many) return fallback;
  return `${item.nameUk}: ${fallback.charAt(0).toLowerCase()}${fallback.slice(1)}`;
}

function factsOf(items: CorridorItemFacts[], order?: Pick<CorridorFacts, "hasCompleteProposal" | "hasApprovedProposal">) {
  const blocking = firstBlocking(items, order);
  const approved = order?.hasApprovedProposal ?? (items.length > 0 && items.every((item) => item.hasApprovedVersion));
  const specLocked = items.some((item) => item.specificationLocked);
  const needsDecorationFile = items.some((item) => item.decorationsCount > 0);
  return { blocking, approved, specLocked, needsDecorationFile, many: items.length > 1 };
}

/**
 * One next door for an order. Completeness is across every line:
 * a version on item 1 does not skip the empty item 2.
 */
export function corridorFor(input: CorridorFacts): CorridorStep {
  const orderFlags = {
    hasCompleteProposal: input.hasCompleteProposal,
    hasApprovedProposal: input.hasApprovedProposal,
  };
  const { blocking, approved, specLocked, needsDecorationFile, many } = factsOf(input.items, orderFlags);
  const quotationReady = approved;
  const specificationReady = specLocked || input.status === "HANDED_TO_PRODUCTION";
  const focusItemId = blocking?.id;

  if (input.status === "CANCELLED") {
    return {
      key: "cancelled",
      index: 0,
      of: LIVE_STEPS,
      label: "Відкрити",
      title: "Замовлення скасовано",
      detail: "Подальших кроків немає.",
      tab: "configuration",
      quotationReady,
      specificationReady,
    };
  }

  if (input.status === "CLOSED") {
    return {
      key: "closed",
      index: LIVE_STEPS,
      of: LIVE_STEPS,
      label: specificationReady ? "Специфікація" : "Документи",
      title: "Замовлення закрито",
      detail: "Склад і ціна збережені в історії.",
      tab: "files",
      quotationReady,
      specificationReady,
    };
  }

  const need = blocking ? itemNeed(blocking, orderFlags) : "ready";

  if (need === "qty") {
    return {
      key: "compose",
      index: 1,
      of: LIVE_STEPS,
      label: "Вказати кількість",
      title: "Спочатку тираж",
      detail: named(
        blocking,
        many,
        "Вкажіть кількості за розмірами — без цього немає ціни й калькуляції.",
      ),
      tab: "configuration",
      focusItemId,
      quotationReady: false,
      specificationReady: false,
    };
  }

  if (need === "compose") {
    return {
      key: "compose",
      index: 1,
      of: LIVE_STEPS,
      label: "Заповнити комплектацію",
      title: "Зберіть склад виробу",
      detail: named(
        blocking,
        many,
        "Додайте матеріали й операції. Нанесення — лише якщо воно є в замовленні.",
      ),
      tab: "configuration",
      focusItemId,
      quotationReady: false,
      specificationReady: false,
    };
  }

  if (need === "saveVersion") {
    return {
      key: "saveVersion",
      index: 2,
      of: LIVE_STEPS,
      label: "Зберегти пропозицію",
      title: "Зафіксуйте ціни для клієнта",
      detail: many
        ? "Комплектацію зібрано. Збережіть пропозицію з цінами всіх позицій — це основа для КП."
        : "Комплектацію зібрано. Збережіть пропозицію — це ціна, яку побачить клієнт.",
      tab: "versions",
      hrefQuery: "action=save",
      focusItemId,
      quotationReady: false,
      specificationReady: false,
    };
  }

  if (need === "approve") {
    return {
      key: "approve",
      index: 3,
      of: LIVE_STEPS,
      label: "Погодити пропозицію",
      title: "Погодьте ціни",
      detail: many
        ? "Пропозицію збережено. Погодьте її цілком — тоді можна сформувати КП і передати в цех."
        : "Пропозицію збережено. Погодження відкриває комерційну пропозицію і шлях у цех.",
      tab: "versions",
      focusItemId,
      quotationReady: false,
      specificationReady: false,
    };
  }

  if (input.status !== "HANDED_TO_PRODUCTION") {
    if (needsDecorationFile && input.filesCount === 0) {
      return {
        key: "artwork",
        index: 4,
        of: LIVE_STEPS,
        label: "Додати макет",
        title: "Потрібен файл нанесення",
        detail:
          "У складі є друк або вишивка. Додайте макет у вкладці «Документи» — без нього цех не зможе виконати нанесення.",
        tab: "files",
        quotationReady,
        specificationReady: false,
      };
    }

    const missing: string[] = [];
    if (!input.deadline) missing.push("дедлайн");
    return {
      key: "handover",
      index: 4,
      of: LIVE_STEPS,
      label: "Передати у виробництво",
      title: missing.length ? "Ще не все для цеху" : "Можна віддати в цех",
      detail: missing.length
        ? `Усі позиції погоджено. Перед передачею вкажіть: ${missing.join(", ")}.`
        : many
          ? "Усі вироби погоджені. Натисніть «Передати у виробництво» — специфікація сформується сама."
          : "Натисніть «Передати у виробництво» — специфікація сформується сама, нічого заповнювати не треба.",
      tab: "versions",
      quotationReady,
      specificationReady: false,
    };
  }

  return {
    key: "spec",
    index: 5,
    of: LIVE_STEPS,
    label: "Специфікація",
    title: "У виробництві",
    detail: "Специфікацію зафіксовано. Цех працює за погодженою пропозицією.",
    tab: "files",
    quotationReady,
    specificationReady: true,
  };
}

export function corridorHref(orderId: string, step: CorridorStep, itemId?: string) {
  const params = new URLSearchParams();
  params.set("tab", step.tab);
  if (step.hrefQuery) {
    const extra = new URLSearchParams(step.hrefQuery);
    extra.forEach((value, key) => params.set(key, value));
  }
  const focus = itemId || step.focusItemId;
  if (focus) params.set("item", focus);
  return `/orders/${orderId}?${params.toString()}`;
}
