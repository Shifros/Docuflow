"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ChartContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Avoid Recharts measuring before the client layout has dimensions. */
export function ChartContainer({ children, className }: ChartContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("h-full w-full min-h-[288px] min-w-0", className)}>
      {mounted ? children : null}
    </div>
  );
}
