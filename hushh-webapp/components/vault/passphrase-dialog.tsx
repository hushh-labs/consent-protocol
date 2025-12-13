// components/vault/passphrase-dialog.tsx

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/lib/morphy-ux/morphy';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle } from 'lucide-react';

interface PassphraseDialogProps {
  open: boolean;
  isCreating: boolean; // true = create new, false = unlock existing
  onConfirm: (passphrase: string) => void;
  onCancel: () => void;
}

export function PassphraseDialog({
  open,
  isCreating,
  onConfirm,
  onCancel,
}: PassphraseDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    // Validation
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    if (isCreating && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    onConfirm(passphrase);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <DialogTitle>
              {isCreating ? 'Create Vault Passphrase' : 'Unlock Your Vault'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isCreating
              ? 'This encrypts your data locally. The server never sees this passphrase.'
              : 'Enter your passphrase to decrypt your vault.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              placeholder="Enter passphrase"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          {isCreating && (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Passphrase</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter passphrase"
                value={confirmPassphrase}
                onChange={(e) => {
                  setConfirmPassphrase(e.target.value);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isCreating && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Save your recovery key after creation. You'll need it if you forget your passphrase.
              </AlertDescription>
            </Alert>
          )}

          {!isCreating && (
            <Alert className="bg-muted">
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔔 Push notification on Hushh Mobile App</span>
                </div>
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="gradient" effect="glass">
            {isCreating ? 'Create Vault' : 'Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
