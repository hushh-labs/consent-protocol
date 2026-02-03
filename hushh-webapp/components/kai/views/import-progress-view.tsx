/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays Gemini AI extraction progress with thinking mode support.
 *
 * Features:
 * - Stage progress indicators (Upload → Analyze → Think → Extract → Complete)
 * - Real-time thought summaries from Gemini thinking mode
 * - Human-readable streaming text display (transforms JSON to readable format)
 * - Character count and chunk count stats
 * - Cancel button
 * - Smart auto-scroll (pauses when user scrolls up, resumes at bottom)
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/morphy-ux";
import {
  StreamingTextDisplay,
  StreamingStageIndicator,
  ThinkingIndicator,
} from "@/lib/morphy-ux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Sparkles, Database, CheckCircle2, Brain, Zap, Code, Eye } from "lucide-react";

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

const stageIcons: Record<ImportStage, React.ReactNode> = {
  idle: <FileText className="w-5 h-5" />,
  uploading: <FileText className="w-5 h-5 animate-pulse" />,
  analyzing: <Sparkles className="w-5 h-5 animate-pulse" />,
  thinking: <Brain className="w-5 h-5 animate-pulse text-purple-500" />,
  extracting: <Zap className="w-5 h-5 animate-pulse text-primary" />,
  streaming: <Zap className="w-5 h-5 animate-pulse text-primary" />,
  parsing: <Database className="w-5 h-5 animate-pulse" />,
  complete: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <X className="w-5 h-5 text-red-500" />,
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
  const [showRawJson, setShowRawJson] = useState(false);
  const [formattedResult, setFormattedResult] = useState<string | null>(null);

  // Determine if we're in a thinking or extracting phase
  const isThinking = stage === "thinking";
  const isExtracting = stage === "extracting" || stage === "streaming" || stage === "parsing";

  // Handle when formatting is complete
  const handleFormatComplete = useCallback((formatted: string) => {
    setFormattedResult(formatted);
  }, []);

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
          {(stage === "analyzing" || isThinking || isExtracting) && (
            <ThinkingIndicator
              message={stageMessages[stage]}
              variant="minimal"
              size="sm"
            />
          )}
          {stage !== "analyzing" && !isThinking && !isExtracting && (
            <p className="text-sm text-muted-foreground">
              {stageMessages[stage]}
            </p>
          )}
        </div>

        {/* Thinking Display - Show AI reasoning */}
        {(isThinking || thoughts.length > 0) && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-500" />
                AI Reasoning
              </span>
              {thoughtCount > 0 && (
                <span>{thoughtCount} thought{thoughtCount !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 max-h-[150px] overflow-y-auto">
              <div className="space-y-2">
                {thoughts.length > 0 ? (
                  thoughts.map((thought, i) => (
                    <div
                      key={i}
                      className="text-sm text-purple-700 dark:text-purple-300 animate-in fade-in slide-in-from-left-1"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span className="text-purple-500 mr-1.5">•</span>
                      {thought}
                    </div>
                  ))
                ) : isThinking ? (
                  <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span>Analyzing document structure...</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Streaming Text Display - Human-Readable Extraction */}
        {(isExtracting || streamedText) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                Data Extraction
              </span>
              <div className="flex items-center gap-3">
                <span>
                  {totalChars.toLocaleString()} chars • {chunkCount} chunks
                </span>
                {/* Toggle between human-readable and raw JSON */}
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                  title={showRawJson ? "Show formatted" : "Show raw JSON"}
                >
                  {showRawJson ? (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Formatted</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-3 h-3" />
                      <span>Raw</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
              {showRawJson ? (
                // Raw JSON view
                <StreamingTextDisplay
                  text={streamedText}
                  isStreaming={isStreaming && isExtracting}
                  showCursor={isStreaming && isExtracting}
                  cursorColor="primary"
                  className="h-[250px] p-4"
                  textClassName="font-mono text-xs"
                  placeholder="Waiting for extraction..."
                  formatAsHuman={false}
                />
              ) : (
                // Human-readable view
                <StreamingTextDisplay
                  text={streamedText}
                  isStreaming={isStreaming && isExtracting}
                  showCursor={isStreaming && isExtracting}
                  cursorColor="primary"
                  className="h-[250px] p-4"
                  textClassName="text-sm"
                  placeholder="Waiting for extraction..."
                  formatAsHuman={true}
                  onFormatComplete={handleFormatComplete}
                />
              )}
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
          <div className="space-y-4">
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
            
            {/* Show formatted result summary */}
            {formattedResult && (
              <div className="bg-muted/30 rounded-xl border border-border/50 p-4 max-h-[300px] overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Extraction Summary</p>
                <pre className="text-sm whitespace-pre-wrap">{formattedResult}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
