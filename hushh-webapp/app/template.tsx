"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div 
      key={pathname}
      className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700"
    >
      {children}
    </div>
  );
}
