"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Sun, Moon, Monitor } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themeOptions: {
    value: ThemeOption;
    icon: any;
    label: string;
  }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div
      className={cn(
        "flex items-center p-1 bg-muted/80 backdrop-blur-3xl rounded-full shadow-2xl ring-1 ring-black/5",
        className
      )}
    >
      {themeOptions.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex items-center justify-center gap-2 px-3 py-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 min-w-[90px]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 min-w-[36px]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                    isActive && "scale-105"
                  )}
                />

                <div
                  className={cn(
                    "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center",
                    isActive
                      ? "w-auto max-w-[100px] opacity-100 ml-0.5"
                      : "w-0 max-w-0 opacity-0"
                  )}
                >
                  <span className="text-xs font-medium whitespace-nowrap">
                    {label}
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            {/* Tooltip only shows if not active (as active shows label) - effectively hidden for now due to expanding pill */}
            <TooltipContent className="hidden">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
