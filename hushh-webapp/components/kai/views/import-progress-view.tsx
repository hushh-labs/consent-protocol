/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays Gemini AI extraction progress like ChatGPT/Perplexity.
 *
 * Features:
 * - Stage progress indicators (Upload → Analyze → Extract → Complete)
 * - Real-time streaming text display with blinking cursor
 * - Character count and chunk count stats
 * - Cancel button
 * - Auto-scroll as content grows
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/morphy-ux";
import {
  StreamingTextDisplay,
  StreamingStageIndicator,
  ThinkingIndicator,
} from "@/lib/morphy-ux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Sparkles, Database, CheckCircle2 } from "lucide-react";

export type ImportStage =
  | "idle"
  | "uploading"
  | "analyzing"
  | "streaming"
  | "parsing"
  | "complete"
  | "error";

export interface ImportProgressViewProps {
  /** Current processing stage */
  stage: ImportStage;
  /** Streamed text from Gemini (raw JSON being built) */
  streamedText: string;
  /** Whether actively streaming */
  isStreaming: boolean;
  /** Total characters received */
  totalChars: number;
  /** Total chunks received */
  chunkCount: number;
  /** Error message if stage is 'error' */
  errorMessage?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const STAGES = ["Upload", "Analyze", "Extract", "Complete"] as const;

const stageToIndex: Record<ImportStage, number> = {
  idle: -1,
  uploading: 0,
  analyzing: 1,
  streaming: 2,
  parsing: 2,
  complete: 3,
  error: -1,
};

const stageIcons: Record<ImportStage, React.ReactNode> = {
  idle: <FileText className="w-5 h-5" />,
  uploading: <FileText className="w-5 h-5 animate-pulse" />,
  analyzing: <Sparkles className="w-5 h-5 animate-pulse" />,
  streaming: <Sparkles className="w-5 h-5 animate-pulse" />,
  parsing: <Database className="w-5 h-5 animate-pulse" />,
  complete: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <X className="w-5 h-5 text-red-500" />,
};

const stageMessages: Record<ImportStage, string> = {
  idle: "Ready to import",
  uploading: "Processing uploaded file...",
  analyzing: "AI analyzing document structure...",
  streaming: "Extracting financial data...",
  parsing: "Processing extracted data...",
  complete: "Import complete!",
  error: "Import failed",
};

export function ImportProgressView({
  stage,
  streamedText,
  isStreaming,
  totalChars,
  chunkCount,
  errorMessage,
  onCancel,
  className,
}: ImportProgressViewProps) {
  const currentStageIndex = stageToIndex[stage];

  // Format the streamed text for display (truncate if too long)
  const displayText = useMemo(() => {
    if (!streamedText) return "";
    // Show last 2000 chars if text is very long
    if (streamedText.length > 2000) {
      return "..." + streamedText.slice(-2000);
    }
    return streamedText;
  }, [streamedText]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {stageIcons[stage]}
            <CardTitle className="text-lg">Importing Portfolio</CardTitle>
          </div>
          {onCancel && stage !== "complete" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stage Progress */}
        <StreamingStageIndicator
          stages={[...STAGES]}
          currentStage={currentStageIndex}
          showLabels
        />

        {/* Status Message */}
        <div className="flex items-center gap-2">
          {(stage === "analyzing" || stage === "streaming" || stage === "parsing") && (
            <ThinkingIndicator
              message={stageMessages[stage]}
              variant="minimal"
              size="sm"
            />
          )}
          {stage !== "analyzing" && stage !== "streaming" && stage !== "parsing" && (
            <p className="text-sm text-muted-foreground">
              {stageMessages[stage]}
            </p>
          )}
        </div>

        {/* Streaming Text Display */}
        {(stage === "streaming" || stage === "parsing" || displayText) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI Response</span>
              <span>
                {totalChars.toLocaleString()} chars • {chunkCount} chunks
              </span>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
              <StreamingTextDisplay
                text={displayText}
                isStreaming={isStreaming}
                showCursor={isStreaming}
                cursorColor="primary"
                className="h-[200px] p-4"
                textClassName="font-mono text-xs"
                placeholder="Waiting for AI response..."
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {stage === "error" && errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-500">{errorMessage}</p>
          </div>
        )}

        {/* Complete State */}
        {stage === "complete" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Successfully extracted portfolio data
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalChars.toLocaleString()} characters processed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
