'use client';

/**
 * Login Page with OAuth + Vault Setup
 * 
 * Flow:
 * 1. User signs in with Google OAuth → UserID
 * 2. Check if vault exists
 * 3. If not: Create vault with passphrase
 * 4. If yes: Unlock vault with passphrase
 * 5. Store vault key in session
 * 6. Redirect to dashboard
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createVault, unlockVault } from '@/lib/vault/e2ee';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    
    try {
      // ═══════════════════════════════════════════
      // STEP 1: OAuth Authentication
      // ═══════════════════════════════════════════
      console.log('🔐 Starting OAuth login...');
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userId = user.uid;
      
      console.log('✅ OAuth successful:', userId);
      
      // ═══════════════════════════════════════════
      // STEP 2: Check Vault Status
      // ═══════════════════════════════════════════
      const checkResponse = await fetch(`/api/vault/check?userId=${userId}`);
      const { hasVault } = await checkResponse.json();
      
      if (!hasVault) {
        // ═══════════════════════════════════════════
        // STEP 3: First-Time User → Create Vault
        // ═══════════════════════════════════════════
        const passphrase = prompt(
          '🔐 Create Your Vault Passphrase\n\n' +
          'This encrypts your food preferences locally.\n' +
          'Choose a strong passphrase you\'ll remember.\n\n' +
          'Server NEVER sees this passphrase.'
        );
        
        if (!passphrase || passphrase.length < 8) {
          setError('Passphrase must be at least 8 characters');
          setLoading(false);
          return;
        }
        
        console.log('🔑 Generating vault key...');
        const vaultSetup = await createVault(passphrase);
        
        // Store encrypted vault key on server
        const setupResponse = await fetch('/api/vault/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            encryptedVaultKey: vaultSetup.encryptedVaultKey,
            salt: vaultSetup.salt,
            iv: vaultSetup.iv,
            authTag: vaultSetup.authTag
          })
        });
        
        if (!setupResponse.ok) {
          throw new Error('Failed to setup vault');
        }
        
        // Store vault key in session (NOT the encrypted version)
        sessionStorage.setItem('vault_key', vaultSetup.vaultKeyHex);
        sessionStorage.setItem('user_id', userId);
        sessionStorage.setItem('user_email', user.email || '');
        
        // Show backup key (IMPORTANT!)
        alert(
          '🔐 SAVE YOUR BACKUP KEY\n\n' +
          vaultSetup.backupKey + '\n\n' +
          'Store this in your password manager.\n' +
          'You\'ll need it to access your vault on other devices.'
        );
        
        console.log('✅ Vault created successfully');
        
        // Redirect to preferences setup
        router.push('/dashboard/setup');
        
      } else {
        // ═══════════════════════════════════════════
        // STEP 4: Returning User → Unlock Vault
        // ═══════════════════════════════════════════
        const passphrase = prompt(
          '🔓 Enter Your Vault Passphrase\n\n' +
          'Unlock your encrypted food preferences.'
        );
        
        if (!passphrase) {
          setError('Passphrase required');
          setLoading(false);
          return;
        }
        
        // Fetch encrypted vault key from server
        const vaultResponse = await fetch(`/api/vault/get?userId=${userId}`);
        const encryptedVault = await vaultResponse.json();
        
        console.log('🔓 Decrypting vault key...');
        
        try {
          const vaultKeyHex = await unlockVault(passphrase, encryptedVault);
          
          // Store in session
          sessionStorage.setItem('vault_key', vaultKeyHex);
          sessionStorage.setItem('user_id', userId);
          sessionStorage.setItem('user_email', user.email || '');
          
          console.log('✅ Vault unlocked successfully');
          
          // Redirect to dashboard
          router.push('/dashboard');
          
        } catch (err) {
          setError('Invalid passphrase. Please try again.');
          setLoading(false);
          return;
        }
      }
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md glass">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">🍽️ Hushh Food</CardTitle>
          <CardDescription className="text-base mt-2">
            Consent-first food recommendations
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}
          
          <Button 
            onClick={handleLogin} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Signing in...
              </>
            ) : (
              <>
                <span className="mr-2">🔐</span>
                Sign in with Google
              </>
            )}
          </Button>
          
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>✅ End-to-end encrypted</p>
            <p>✅ Your data stays private</p>
            <p>✅ Server cannot decrypt your vault</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
