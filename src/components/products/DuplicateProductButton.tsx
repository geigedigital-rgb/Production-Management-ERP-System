"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { duplicateProductAction } from "@/server/domains/products/actions";

export function DuplicateProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("productId", productId);
        startTransition(async () => {
          const result = await duplicateProductAction(formData);
          if (!result.ok) return;
          router.push(`/products/${result.productId}`);
          router.refresh();
        });
      }}
    >
      {pending ? "Копіювання…" : "Дублювати виріб"}
    </Button>
  );
}
