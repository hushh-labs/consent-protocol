"use client";

/**
 * Checkbox Selector Component
 *
 * Interactive selection UI for chat preferences.
 * Allows users to select from options + add custom text.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Send, Plus, Check } from "lucide-react";

interface CheckboxSelectorProps {
  options: string[];
  onSubmit: (selected: string[]) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  submitLabel?: string;
  className?: string;
  multiSelect?: boolean;
}

export function CheckboxSelector({
  options,
  onSubmit,
  allowCustom = true,
  customPlaceholder = "Add custom option...",
  submitLabel = "Continue",
  className,
  multiSelect = true,
}: CheckboxSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customValue, setCustomValue] = useState("");
  const [customItems, setCustomItems] = useState<string[]>([]);

  const toggleOption = (option: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(option)) {
      newSelected.delete(option);
    } else {
      if (!multiSelect) {
        newSelected.clear();
      }
      newSelected.add(option);
    }
    setSelected(newSelected);
  };

  const addCustom = () => {
    if (customValue.trim()) {
      const formatted = customValue.trim().toLowerCase().replace(/\s+/g, "_");
      setCustomItems([...customItems, formatted]);
      setSelected(new Set([...selected, formatted]));
      setCustomValue("");
    }
  };

  const handleSubmit = () => {
    const allSelected = Array.from(selected);
    onSubmit(allSelected.length > 0 ? allSelected : ["none"]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customValue.trim()) {
        addCustom();
      } else {
        handleSubmit();
      }
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Options Grid - Scrollable, max 2 rows */}
      <div className="max-h-[140px] overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap gap-2">
          {[...options, ...customItems].map((option) => {
            const isSelected = selected.has(option);
            const displayName = option
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());

            return (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all text-xs",
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500"
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
                <span className="font-medium truncate max-w-[150px]">
                  {displayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Input & Submit Row */}
      <div className="flex gap-2 items-center">
        {allowCustom && (
          <div className="flex-1 flex gap-2">
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={customPlaceholder}
              className="h-8 text-xs bg-white dark:bg-gray-800/50"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={addCustom}
              disabled={!customValue.trim()}
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 ml-auto"
        >
          {submitLabel}
          <Send className="ml-2 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
