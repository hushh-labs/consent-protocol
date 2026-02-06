"use client";

/**
 * Morphy-UX Tabs
 *
 * Material 3 Expressive ripple effect with state layer mechanics:
 * - Hover: 8% opacity state layer
 * - Press: 10% opacity + radial ripple animation
 * - Active: highlighted with background
 */

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { MaterialRipple } from "@/lib/morphy-ux/material-ripple";

// ============================================================================
// TABS ROOT
// ============================================================================

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="morphy-tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

// ============================================================================
// TABS LIST
// ============================================================================

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="morphy-tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-14 w-fit items-center justify-center rounded-lg p-1",
        className
      )}
      {...props}
    />
  );
}

// ============================================================================
// TABS TRIGGER - WITH MATERIAL 3 RIPPLE
// ============================================================================

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="morphy-tabs-trigger"
      className={cn(
        // Base styles
        "relative overflow-hidden inline-flex h-[calc(100%-4px)] flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer",
        // Default state
        "text-muted-foreground",
        // Hover state (M3: 8% state layer)
        "hover:text-foreground hover:bg-foreground/8",
        // Active state
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // Icons
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      {/* Material 3 Expressive Ripple */}
      <MaterialRipple variant="link" effect="glass" />
    </TabsPrimitive.Trigger>
  );
}

// ============================================================================
// TABS CONTENT
// ============================================================================

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="morphy-tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
