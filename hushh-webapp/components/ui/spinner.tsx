"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  size = 24,
  ...props
}: React.ComponentProps<"svg"> & { size?: number }) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", className)}
      size={size}
      {...props}
    />
  );
}
