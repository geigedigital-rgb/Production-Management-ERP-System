-- Fixed overhead (постійні витрати): company params + articles + per-order sewer override

CREATE TABLE "fixed_cost_settings" (
    "id" TEXT NOT NULL,
    "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 21,
    "sewerCount" INTEGER NOT NULL DEFAULT 5,
    "dailySewerPay" DECIMAL(14,4) NOT NULL DEFAULT 1500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_cost_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fixed_cost_articles" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(14,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_cost_articles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_items" ADD COLUMN "sewerCountOverride" INTEGER;
