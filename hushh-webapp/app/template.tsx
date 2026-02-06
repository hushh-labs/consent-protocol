"use client";

import { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      {children}
    </div>
  );
}
