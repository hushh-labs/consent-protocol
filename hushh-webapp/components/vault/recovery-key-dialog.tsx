// components/vault/recovery-key-dialog.tsx

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/lib/morphy-ux/morphy';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { downloadTextFile } from '@/lib/utils/native-download';

interface RecoveryKeyDialogProps {
  open: boolean;
  recoveryKey: string;
  onContinue: () => void;
}

export function RecoveryKeyDialog({
  open,
  recoveryKey,
  onContinue,
}: RecoveryKeyDialogProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = async () => {
    const content = `Hushh Vault Recovery Key\n\n${recoveryKey}\n\nKeep this safe! You'll need it if you forget your passphrase.`;
    const success = await downloadTextFile(content, 'hushh-recovery-key.txt');
    if (success) {
      setDownloaded(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Save Your Recovery Key
          </DialogTitle>
          <DialogDescription>
            This is the ONLY way to recover your vault if you forget your passphrase.
            Save it somewhere safe!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This recovery key will only be shown once. 
              We cannot recover it for you if you lose it.
            </AlertDescription>
          </Alert>

          <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
            <code className="text-sm font-mono break-all">
              {recoveryKey}
            </code>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Key
                </>
              )}
            </Button>

            <Button
              onClick={handleDownload}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloaded ? 'Downloaded' : 'Download'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onContinue}
            variant="gradient"
            effect="glass"
            className="w-full"
            disabled={!copied && !downloaded}
          >
            I've Saved My Recovery Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
