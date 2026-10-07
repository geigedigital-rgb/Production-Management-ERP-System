"use client";

import { ViewTabs, type TabItem } from "@/components/ui/Tabs";
import { useOrderUnsavedOptional } from "@/components/orders/OrderUnsavedContext";

export function OrderWorkspaceTabs({
  items,
  active,
  className,
}: {
  items: TabItem[];
  active: string;
  className?: string;
}) {
  const unsaved = useOrderUnsavedOptional();
  return (
    <ViewTabs
      items={items}
      active={active}
      className={className}
      onNavigate={unsaved ? (href) => unsaved.requestNavigate(href) : undefined}
    />
  );
}
