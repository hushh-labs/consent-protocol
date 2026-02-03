// components/dashboard/domain-nav.tsx
// Domain nav: Kai-first; additional domains can be driven by WorldModelService.listDomains() when needed.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const domains = [
  {
    name: "Kai",
    href: "/kai/dashboard",
    icon: TrendingUp,
    status: "active" as const,
    color: "text-primary",
  },
];

export function DomainNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {domains.map((domain) => {
        const Icon = domain.icon;
        const isActive = pathname?.startsWith(domain.href);

        return (
          <Link
            key={domain.name}
            href={domain.href}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("h-5 w-5", domain.color)} />
              <span>{domain.name}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
