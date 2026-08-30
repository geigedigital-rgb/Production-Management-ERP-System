"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

/** Submit button that reflects the pending state of its enclosing form. */
export function SubmitButton({ children, pendingLabel, className, ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} className={cn(className)} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
