// components/kai/views/portfolio-import-view.tsx

/**
 * Portfolio Import View - Full-screen UI for uploading brokerage statements
 *
 * Features:
 * - Drag-and-drop zone for PDF/CSV files
 * - Supported brokerages list
 * - Skip option (minimal)
 */

"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { Upload, FileText, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// TYPES
// =============================================================================

interface PortfolioImportViewProps {
  onFileSelect: (file: File) => void;
  onSkip: () => void;
  isUploading?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioImportView({
  onFileSelect,
  onSkip,
  isUploading = false,
}: PortfolioImportViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (file && (file.type === "application/pdf" || file.name.endsWith(".csv"))) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        setSelectedFile(files[0]);
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Trigger file input click
  const triggerFileInput = () => {
    const input = document.getElementById("file-input") as HTMLInputElement;
    input?.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Import Your Portfolio
        </h1>
        <p className="text-muted-foreground">
          Upload your brokerage statement to get personalized investment insights
        </p>
      </div>

      {/* Main Import Card */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardContent className="p-8">
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 text-center cursor-pointer",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border hover:border-primary/50 hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-50"
            )}
            onClick={triggerFileInput}
          >
            {/* Upload Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {isDragging
                  ? "Drop your file here"
                  : "Drag & drop your statement"}
              </h3>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>

            {/* Selected File Display */}
            {selectedFile && !isUploading && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm">
                <FileText className="w-4 h-4" />
                <span>{selectedFile.name}</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            )}

            {/* Hidden File Input */}
            <input
              id="file-input"
              type="file"
              accept=".csv,.pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          {/* Supported Formats */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Supported formats: CSV, PDF
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Supported Brokerages */}
      <Card variant="muted" effect="glass" showRipple={false}>
        <CardHeader>
          <CardTitle className="text-base">Supported Brokerages</CardTitle>
          <CardDescription>
            We support statements from these brokerages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "Fidelity",
              "Charles Schwab",
              "Robinhood",
              "E*TRADE",
              "TD Ameritrade",
              "Interactive Brokers",
              "Vanguard",
              "Merrill Edge",
            ].map((brokerage) => (
              <div
                key={brokerage}
                className="flex items-center gap-2 p-2 rounded bg-background/50 text-sm"
              >
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>{brokerage}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Don't see your brokerage? We'll do our best to parse generic CSV
            formats.
          </p>
        </CardContent>
      </Card>

      {/* Plaid Integration - Coming Soon */}
      <Card variant="none" effect="glass" showRipple={false}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Connect with Plaid</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically sync your brokerage accounts
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              Coming Soon
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Skip Option */}
      <div className="text-center">
        <Button
          variant="none"
          effect="fade"
          onClick={onSkip}
          disabled={isUploading}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
