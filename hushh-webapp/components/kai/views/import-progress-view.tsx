/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays Gemini AI extraction progress with thinking mode support.
 *
 * Features:
 * - Stage progress indicators (Upload → Analyze → Think → Extract → Complete)
 * - Real-time thought summaries from Gemini thinking mode (in StreamingAccordion)
 * - Human-readable streaming text display (transforms JSON to readable format)
 * - Character count and chunk count stats
 * - Cancel button
 * - Auto-collapsing accordions when streaming completes
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/morphy-ux";
import {
  StreamingStageIndicator,
  ThinkingIndicator,
} from "@/lib/morphy-ux";
import { StreamingAccordion } from "@/lib/morphy-ux/streaming-accordion";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/lib/morphy-ux/card";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { X, FileText, FileChartColumn, Database, CheckCircle2, Loader2, Zap } from "lucide-react";


export type ImportStage =
  | "idle"
  | "uploading"
  | "analyzing"
  | "thinking"
  | "extracting"
  | "streaming" // Legacy - maps to extracting
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
  /** Array of thought summaries from Gemini thinking mode */
  thoughts?: string[];
  /** Total thought count */
  thoughtCount?: number;
  /** Error message if stage is 'error' */
  errorMessage?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const STAGES = ["Upload", "Analyze", "Think", "Extract", "Complete"] as const;

const stageToIndex: Record<ImportStage, number> = {
  idle: -1,
  uploading: 0,
  analyzing: 1,
  thinking: 2,
  extracting: 3,
  streaming: 3, // Legacy mapping
  parsing: 3,
  complete: 4,
  error: -1,
};

const stageMessages: Record<ImportStage, string> = {
  idle: "Ready to import",
  uploading: "Processing uploaded file...",
  analyzing: "AI analyzing document structure...",
  thinking: "AI reasoning about your portfolio...",
  extracting: "Extracting financial data...",
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
  thoughts = [],
  thoughtCount = 0,
  errorMessage,
  onCancel,
  className,
}: ImportProgressViewProps) {
  const currentStageIndex = stageToIndex[stage];
  const [formattedResult, setFormattedResult] = useState<string | null>(null);

  // Determine if we're in a thinking or extracting phase
  const isThinking = stage === "thinking";
  const isExtracting = stage === "extracting" || stage === "streaming" || stage === "parsing";
  const isComplete = stage === "complete";

  // Format thoughts into a single text string for the accordion
  // Matches the [N] **Header** pattern for bold rendering
  const thoughtsText = useMemo(() => {
    if (thoughts.length === 0) {
      return isThinking ? "[1] **Analyzing portfolio structure**\nInitializing extraction engine..." : "";
    }
    return thoughts.map((t, i) => `[${i + 1}] **${t}**`).join("\n");
  }, [thoughts, isThinking]);

  // Handle when formatting is complete
  const handleFormatComplete = useCallback((formatted: string) => {
    setFormattedResult(formatted);
  }, []);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileChartColumn className={cn("w-5 h-5", isStreaming && "text-primary")} />
            <CardTitle className="text-lg">Importing Portfolio</CardTitle>
          </div>
          {onCancel && stage !== "complete" && (
            <MorphyButton
              variant="muted"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8 rounded-lg"
              icon={{ icon: X }}
            />
          )}

        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stage Progress */}
        <StreamingStageIndicator
          stages={[...STAGES]}
          currentStage={currentStageIndex}
          showLabels
        />

        {/* Status Message */}
        <div className="flex items-center gap-2">
          {stage !== "analyzing" && !isThinking && !isExtracting && (
            <p className="text-sm text-muted-foreground">
              {stageMessages[stage]}
            </p>
          )}
        </div>


        {/* AI Reasoning Accordion - Shows during thinking phase, persists when complete */}
        {(isThinking || (thoughts.length > 0 && !isComplete) || (isComplete && thoughts.length > 0)) && (
          <StreamingAccordion
            id="ai-reasoning"
            title={`AI Reasoning${thoughtCount > 0 ? ` (${thoughtCount} thoughts)` : ""}`}
            text={thoughtsText}
            isStreaming={isThinking || isExtracting}
            isComplete={isComplete}
            icon={isComplete ? "brain" : "spinner"}
            className="border-primary/10"
          />
        )}



        {/* Data Extraction Accordion - Shows during extraction phase, persists when complete */}
        {(isExtracting || (streamedText && !isComplete) || (isComplete && streamedText)) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-primary" />
                Data Extraction
              </span>
              <span>
                {totalChars.toLocaleString()} chars • {chunkCount} chunks
              </span>
            </div>
            <StreamingAccordion
              id="data-extraction"
              title="Extracted Portfolio Data"
              text={streamedText}
              isStreaming={isStreaming && isExtracting}
              isComplete={isComplete}
              formatAsHuman={true}
              icon={isComplete ? "database" : "spinner"}
              iconClassName="w-6 h-6"
              maxHeight="300px"
              defaultExpanded={true}
            />
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
              {thoughtCount > 0 && ` • ${thoughtCount} AI reasoning steps`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
