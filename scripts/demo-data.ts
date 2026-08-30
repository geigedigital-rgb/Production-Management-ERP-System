/**
 * Populates a realistic demo dataset (catalogs -> products -> clients -> orders in
 * every pipeline stage) so UI states can be reviewed without manual data entry.
 * Safe to re-run: records are matched by name/number and reused.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { prisma } = await import("../src/server/db/client");
  const { buildCalcFromOrderItem, getPricingDefaults } = await import(
    "../src/server/domains/calculation/from-entities"
  );
  const {
    createOrderWithProduct,
    saveCalculationVersion,
    approveVersion,
    handOverToProduction,
    updateOrderStatus,
  } = await import("../src/server/domains/orders/service");
  const { getOrder } = await import("../src/server/domains/orders/service");

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR" } });
  const unit = async (code: string) =>
    prisma.unitOfMeasure.findFirstOrThrow({ where: { code } });

  const [m, m2, pcs] = await Promise.all([unit("m"), unit("m2"), unit("pcs")]);

  const category = async (nameUk: string, kind: string) =>
    prisma.category.upsert({
      where: { kind_nameUk: { kind, nameUk } },
      update: {},
      create: { nameUk, kind },
    });

  const fabrics = await category("Тканини", "MATERIAL");
  const trims = await category("Фурнітура", "MATERIAL");
  const sewing = await category("Пошиття", "OPERATION");
  const apparel = await category("Одяг", "PRODUCT");

  async function material(data: {
    nameUk: string;
    type: "FABRIC" | "TRIM" | "OTHER_MATERIAL";
    unitOfMeasureId: string;
    categoryId: string;
    purchasePrice: number;
    defaultWastePercent: number;
    colorOrAttribute?: string;
    supplierCode?: string;
  }) {
    const found = await prisma.material.findFirst({ where: { nameUk: data.nameUk } });
    if (found) return found;
    return prisma.material.create({ data: { ...data, priceEffectiveDate: new Date() } });
  }

  const fleece = await material({
    nameUk: "Футер тринитка з начосом",
    type: "FABRIC",
    unitOfMeasureId: m.id,
    categoryId: fabrics.id,
    purchasePrice: 268,
    defaultWastePercent: 7,
    colorOrAttribute: "графіт",
    supplierCode: "FT-330-GR",
  });
  const rib = await material({
    nameUk: "Кашкорсе (манжет)",
    type: "FABRIC",
    unitOfMeasureId: m.id,
    categoryId: fabrics.id,
    purchasePrice: 190,
    defaultWastePercent: 5,
    colorOrAttribute: "графіт",
  });
  const oxford = await material({
    nameUk: "Оксфорд 600D PU",
    type: "FABRIC",
    unitOfMeasureId: m2.id,
    categoryId: fabrics.id,
    purchasePrice: 145,
    defaultWastePercent: 9,
    colorOrAttribute: "чорний",
  });
  const zipper = await material({
    nameUk: "Блискавка роз'ємна YKK 60 см",
    type: "TRIM",
    unitOfMeasureId: pcs.id,
    categoryId: trims.id,
    purchasePrice: 42,
    defaultWastePercent: 2,
  });
  const label = await material({
    nameUk: "Етикетка тканинна з логотипом",
    type: "TRIM",
    unitOfMeasureId: pcs.id,
    categoryId: trims.id,
    purchasePrice: 3.4,
    defaultWastePercent: 1,
  });
  const strap = await material({
    nameUk: "Стропа поліпропіленова 25 мм",
    type: "TRIM",
    unitOfMeasureId: m.id,
    categoryId: trims.id,
    purchasePrice: 11.5,
    defaultWastePercent: 3,
  });

  async function operation(data: {
    nameUk: string;
    calculationMethod: "UNIT_RATE" | "SHIFT_OUTPUT";
    baseRate?: number;
    shiftCost?: number;
    standardOutputPerShift?: number;
    note?: string;
  }) {
    const found = await prisma.operation.findFirst({ where: { nameUk: data.nameUk } });
    if (found) return found;
    return prisma.operation.create({ data: { ...data, categoryId: sewing.id } });
  }

  const cutting = await operation({
    nameUk: "Розкрій",
    calculationMethod: "SHIFT_OUTPUT",
    shiftCost: 3200,
    standardOutputPerShift: 180,
    note: "Зміна 8 год, розкрійна бригада",
  });
  const stitching = await operation({
    nameUk: "Пошиття основне",
    calculationMethod: "UNIT_RATE",
    baseRate: 96,
  });
  const finishing = await operation({
    nameUk: "ВТО та пакування",
    calculationMethod: "UNIT_RATE",
    baseRate: 24,
  });
  const qc = await operation({
    nameUk: "Контроль якості",
    calculationMethod: "SHIFT_OUTPUT",
    shiftCost: 2400,
    standardOutputPerShift: 300,
  });

  async function decoration(data: {
    nameUk: string;
    calculationUnit: string;
    setupCost: number;
    unitRate: number;
    note?: string;
  }) {
    const found = await prisma.decorationMethod.findFirst({ where: { nameUk: data.nameUk } });
    if (found) return found;
    return prisma.decorationMethod.create({ data });
  }

  const embroidery = await decoration({
    nameUk: "Вишивка (до 8 000 стібків)",
    calculationUnit: "UNIT",
    setupCost: 850,
    unitRate: 38,
    note: "Приладка програми оплачується один раз на партію",
  });
  const silkscreen = await decoration({
    nameUk: "Шовкодрук, 2 кольори",
    calculationUnit: "UNIT",
    setupCost: 1200,
    unitRate: 17,
  });
  await decoration({
    nameUk: "DTF-перенесення",
    calculationUnit: "UNIT",
    setupCost: 0,
    unitRate: 46,
  });

  const sizes = await prisma.size.findMany({ orderBy: { sortOrder: "asc" } });
  const sizeByCode = new Map(sizes.map((s) => [s.code, s]));

  async function product(input: {
    nameUk: string;
    internalCode: string;
    description: string;
    imageUrl?: string;
    sizeCodes: string[];
    materials: Array<{ materialId: string; consumptionPerUnit: number; wastePercent?: number }>;
    operationIds: string[];
    decorationIds: string[];
    additionalCosts?: Array<{ nameUk: string; amount: number; isPerUnit: boolean }>;
  }) {
    const existing = await prisma.product.findUnique({
      where: { internalCode: input.internalCode },
    });
    if (existing) {
      if (input.imageUrl && existing.imageUrl !== input.imageUrl) {
        return prisma.product.update({
          where: { id: existing.id },
          data: { imageUrl: input.imageUrl },
        });
      }
      return existing;
    }

    return prisma.product.create({
      data: {
        nameUk: input.nameUk,
        internalCode: input.internalCode,
        description: input.description,
        imageUrl: input.imageUrl ?? null,
        categoryId: apparel.id,
        sizes: {
          create: input.sizeCodes
            .map((code) => sizeByCode.get(code))
            .filter((size): size is NonNullable<typeof size> => Boolean(size))
            .map((size) => ({ sizeId: size.id })),
        },
        materials: { create: input.materials },
        operations: { create: input.operationIds.map((operationId) => ({ operationId })) },
        decorations: {
          create: input.decorationIds.map((decorationMethodId) => ({ decorationMethodId })),
        },
        additionalCosts: { create: input.additionalCosts ?? [] },
      },
    });
  }

  const hoodie = await product({
    nameUk: "Худі оверсайз на флісі",
    internalCode: "HD-320",
    description: "Корпоративне худі, футер 320 г/м², манжети кашкорсе, вишивка на грудях.",
    imageUrl:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=240&h=240&q=80",
    sizeCodes: ["S", "M", "L", "XL"],
    materials: [
      { materialId: fleece.id, consumptionPerUnit: 1.65, wastePercent: 8 },
      { materialId: rib.id, consumptionPerUnit: 0.28 },
      { materialId: label.id, consumptionPerUnit: 2 },
    ],
    operationIds: [cutting.id, stitching.id, finishing.id, qc.id],
    decorationIds: [embroidery.id],
    additionalCosts: [{ nameUk: "Пакування та бирки", amount: 12, isPerUnit: true }],
  });

  const tshirt = await product({
    nameUk: "Футболка промо 160 г/м²",
    internalCode: "TS-160",
    description: "Базова промо-футболка під шовкодрук, партії від 100 шт.",
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=240&h=240&q=80",
    sizeCodes: ["S", "M", "L", "XL", "XXL"],
    materials: [
      { materialId: rib.id, consumptionPerUnit: 0.05 },
      { materialId: label.id, consumptionPerUnit: 1 },
    ],
    operationIds: [cutting.id, stitching.id, finishing.id],
    decorationIds: [silkscreen.id],
  });

  await product({
    nameUk: "Рюкзак міський 22 л",
    internalCode: "BP-022",
    description: "Чернетка: комплектація ще не завершена, потрібні операції та нанесення.",
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=240&h=240&q=80",
    sizeCodes: [],
    materials: [
      { materialId: oxford.id, consumptionPerUnit: 1.2 },
      { materialId: zipper.id, consumptionPerUnit: 2 },
      { materialId: strap.id, consumptionPerUnit: 2.4 },
    ],
    operationIds: [],
    decorationIds: [],
  });

  async function client(data: {
    companyName: string;
    contactPerson: string;
    phone: string;
    email: string;
    legalDetails?: string;
    note?: string;
  }) {
    const found = await prisma.client.findFirst({ where: { companyName: data.companyName } });
    if (found) return found;
    return prisma.client.create({ data });
  }

  const nova = await client({
    companyName: "ТОВ «Нова Логістика»",
    contactPerson: "Ірина Ковальчук",
    phone: "+380 67 214 88 30",
    email: "i.kovalchuk@novalog.ua",
    legalDetails: "ЄДРПОУ 41225508, м. Київ, вул. Бориспільська 9",
    note: "Оплата 50/50, документи через «Вчасно».",
  });
  const brew = await client({
    companyName: "Craft Brew Group",
    contactPerson: "Олег Дорошенко",
    phone: "+380 50 771 09 12",
    email: "oleg@craftbrew.com.ua",
    legalDetails: "ФОП Дорошенко О. В., м. Львів",
  });
  const medlab = await client({
    companyName: "МедЛаб Україна",
    contactPerson: "Тетяна Гриценко",
    phone: "+380 63 500 21 44",
    email: "t.grytsenko@medlab.ua",
    note: "Потрібні сертифікати на тканину до відвантаження.",
  });

  const pricing = await getPricingDefaults();

  async function ensureOrder(input: {
    clientId: string;
    productId: string;
    title: string;
    deadlineInDays: number;
    quantities: Array<[string, number]>;
    comment?: string;
    stage: "CALCULATION" | "PENDING_APPROVAL" | "APPROVED" | "HANDED_TO_PRODUCTION";
  }) {
    const existing = await prisma.order.findFirst({
      where: { clientId: input.clientId, title: input.title },
    });
    if (existing) return existing;

    const { order, item } = await createOrderWithProduct({
      clientId: input.clientId,
      managerId: admin.id,
      productId: input.productId,
      title: input.title,
      deadline: new Date(Date.now() + input.deadlineInDays * 86_400_000),
      comment: input.comment ?? null,
      sizeQuantities: input.quantities.map(([code, quantity]) => ({
        sizeCode: code,
        sizeNameUk: code,
        quantity,
      })),
    });

    if (input.stage === "CALCULATION") return order;

    const full = await getOrder(order.id);
    const detailed = full?.items.find((row) => row.id === item.id);
    if (!detailed) return order;

    const calc = buildCalcFromOrderItem(detailed, pricing);
    const version = await saveCalculationVersion({
      orderItemId: item.id,
      authorId: admin.id,
      label: "Базовий розрахунок",
      comment: "Ціни матеріалів актуальні на дату створення.",
      snapshot: JSON.parse(
        JSON.stringify({
          item: {
            nameUk: detailed.nameUk,
            totalQuantity: detailed.totalQuantity,
            sizes: detailed.sizes,
            materials: detailed.materials,
            operations: detailed.operations,
            decorations: detailed.decorations,
            additionalCosts: detailed.additionalCosts,
          },
          calc,
          pricing,
          manualSellingPricePerUnit: null,
        }),
      ),
      totals: {
        costPerUnit: Number(calc.costPerUnit),
        totalCost: Number(calc.totalCost),
        sellingPricePerUnit: Number(calc.sellingPricePerUnit),
        totalSellingValue: Number(calc.totalSellingValue),
        profitAmount: Number(calc.profitAmount),
        marginPercent: Number(calc.marginPercent),
      },
    });

    if (input.stage === "PENDING_APPROVAL") {
      await updateOrderStatus(order.id, "PENDING_APPROVAL", admin.id);
      return order;
    }

    await approveVersion(version.id, admin.id);
    if (input.stage === "HANDED_TO_PRODUCTION") {
      await handOverToProduction(order.id, admin.id);
    }
    return order;
  }

  await ensureOrder({
    clientId: nova.id,
    productId: hoodie.id,
    title: "Худі для складської команди",
    deadlineInDays: 21,
    quantities: [
      ["S", 20],
      ["M", 45],
      ["L", 60],
      ["XL", 25],
    ],
    comment: "Вишивка на грудях, логотип у два кольори.",
    stage: "HANDED_TO_PRODUCTION",
  });

  await ensureOrder({
    clientId: brew.id,
    productId: tshirt.id,
    title: "Промо-футболки на фестиваль",
    deadlineInDays: 9,
    quantities: [
      ["S", 50],
      ["M", 120],
      ["L", 120],
      ["XL", 60],
      ["XXL", 30],
    ],
    comment: "Друк на спині, макет надішлють до понеділка.",
    stage: "APPROVED",
  });

  await ensureOrder({
    clientId: medlab.id,
    productId: hoodie.id,
    title: "Худі для медичних представників",
    deadlineInDays: 4,
    quantities: [
      ["M", 30],
      ["L", 30],
    ],
    comment: "Клієнт просить знижку, потрібне рішення керівника.",
    stage: "PENDING_APPROVAL",
  });

  await ensureOrder({
    clientId: nova.id,
    productId: tshirt.id,
    title: "Футболки для водіїв (розрахунок)",
    deadlineInDays: -2,
    quantities: [
      ["M", 40],
      ["L", 40],
      ["XL", 20],
    ],
    stage: "CALCULATION",
  });

  const { recordActivity } = await import("../src/server/domains/activity/service");
  const { orderStatusLabel } = await import("../src/lib/order-status");
  const allOrders = await prisma.order.findMany({
    select: { id: true, number: true, status: true, clientId: true },
  });
  for (const order of allOrders) {
    const existingEvents = await prisma.activityEvent.count({
      where: { entityType: "order", entityId: order.id },
    });
    if (existingEvents > 0) continue;

    await recordActivity({
      entityType: "order",
      entityId: order.id,
      action: "created",
      userId: admin.id,
      payload: { number: order.number, clientId: order.clientId, backfill: true },
    });
    if (order.status !== "DRAFT" && order.status !== "CALCULATION") {
      await recordActivity({
        entityType: "order",
        entityId: order.id,
        action: "status_changed",
        userId: admin.id,
        payload: {
          from: "CALCULATION",
          to: order.status,
          fromLabel: orderStatusLabel.CALCULATION,
          toLabel: orderStatusLabel[order.status] ?? order.status,
          backfill: true,
        },
      });
    }
    if (order.status === "APPROVED" || order.status === "HANDED_TO_PRODUCTION") {
      await recordActivity({
        entityType: "order",
        entityId: order.id,
        action: "version_approved",
        userId: admin.id,
        payload: { backfill: true },
      });
    }
    if (order.status === "HANDED_TO_PRODUCTION") {
      await recordActivity({
        entityType: "order",
        entityId: order.id,
        action: "handed_to_production",
        userId: admin.id,
        payload: { number: order.number, backfill: true },
      });
    }
  }

  console.log("Demo data ready:", {
    clients: await prisma.client.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    materials: await prisma.material.count(),
    operations: await prisma.operation.count(),
    decorations: await prisma.decorationMethod.count(),
    versions: await prisma.calculationVersion.count(),
    activity: await prisma.activityEvent.count(),
  });
}

main().then(() => process.exit(0));
