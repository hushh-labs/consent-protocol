"use client";

/**
 * Collected Data Card
 * 
 * Displays real-time collected preferences as the user chats.
 * Updates live as the conversation progresses.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCollectedData } from "@/lib/format-message";
import { cn } from "@/lib/utils";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface CollectedDataCardProps {
  data: Record<string, unknown>;
  domain?: string;
  className?: string;
  isExpanded?: boolean;
}

export function CollectedDataCard({ 
  data, 
  domain = "Preferences",
  className,
  isExpanded: defaultExpanded = true
}: CollectedDataCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const items = formatCollectedData(data);
  
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={cn(
      "border shadow-lg transition-all duration-300",
      "bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm",
      "border-emerald-200 dark:border-emerald-800",
      className
    )}>
      <CardHeader 
        className="py-3 px-4 cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-sm font-medium">
            Collected Data
          </CardTitle>
          <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-base leading-none mt-0.5">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-muted-foreground">
                    {item.label}:
                  </span>
                  <span className="ml-1.5 text-foreground truncate">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
