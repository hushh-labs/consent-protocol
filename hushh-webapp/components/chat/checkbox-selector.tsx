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
import { Send, Plus } from "lucide-react";

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
  multiSelect = true
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
      const formatted = customValue.trim().toLowerCase().replace(/\s+/g, '_');
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
    <div className={cn("space-y-4 p-4 rounded-xl border bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm", className)}>
      {/* Options Grid - Scrollable, max 2 rows */}
      <div className="max-h-[120px] overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
          {[...options, ...customItems].map((option) => {
            const isSelected = selected.has(option);
            const displayName = option.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            return (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm",
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => toggleOption(option)}
                  className="pointer-events-none h-4 w-4"
                />
                <Label className="cursor-pointer text-xs font-medium truncate">
                  {displayName}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Input */}
      {allowCustom && (
        <div className="flex gap-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={customPlaceholder}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={addCustom}
            disabled={!customValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Submit Button */}
      <Button 
        onClick={handleSubmit}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {submitLabel}
        <Send className="ml-2 h-4 w-4" />
      </Button>

      {/* None option */}
      {selected.size === 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Select options above, or click Continue for "None"
        </p>
      )}
    </div>
  );
}
