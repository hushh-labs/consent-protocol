'use client';

/**
 * Login Page - Hushh PDA
 * OAuth + E2EE Vault Setup with Shadcn Dialogs
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { createVault, unlockVault } from '@/lib/vault/e2ee';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/lib/morphy-ux/morphy';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PassphraseDialog } from '@/components/vault/passphrase-dialog';
import { RecoveryKeyDialog } from '@/components/vault/recovery-key-dialog';
import { Shield, Lock, Key, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Redirect if already logged in
  useEffect(() => {
    const userId = sessionStorage.getItem('user_id');
    if (userId) {
      router.push('/dashboard');
    }
  }, [router]);
  
  // Dialog states
  const [showPassphraseDialog, setShowPassphraseDialog] = useState(false);
  const [isCreatingVault, setIsCreatingVault] = useState(false);
  const [showRecoveryKeyDialog, setShowRecoveryKeyDialog] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  
  // Temporary state for vault creation flow
  const [tempUserId, setTempUserId] = useState('');
  const [tempUserData, setTempUserData] = useState<any>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔐 Starting OAuth login...');
      
      const provider = new GoogleAuthProvider();
      
      // Center the OAuth popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      // Attempt sign in
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        // User closed popup or cancelled
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
          console.log('User cancelled login');
          setLoading(false);
          return;
        }
        throw popupError;
      }
      
      const user = result.user;
      
      // Save ALL Firebase user data to sessionStorage
      sessionStorage.setItem('user_id', `google:${user.uid}`);
      sessionStorage.setItem('user_uid', user.uid);
      sessionStorage.setItem('user_email', user.email || '');
      sessionStorage.setItem('user_displayName', user.displayName || '');
      sessionStorage.setItem('user_photo', user.photoURL || '');
      sessionStorage.setItem('user_emailVerified', user.emailVerified.toString());
      sessionStorage.setItem('user_phoneNumber', user.phoneNumber || '');
      sessionStorage.setItem('user_creationTime', user.metadata.creationTime || '');
      sessionStorage.setItem('user_lastSignInTime', user.metadata.lastSignInTime || '');
      sessionStorage.setItem('user_providerData', JSON.stringify(user.providerData));
      
      console.log('✅ OAuth successful, user data saved');
      
      // Store temp data for vault flow
      setTempUserId(user.uid);
      setTempUserData(user);
      
      // Check if vault exists
      const checkResponse = await fetch(`/api/vault/check?userId=${user.uid}`);
      const { hasVault } = await checkResponse.json();
      
      if (!hasVault) {
        // New user - show create passphrase dialog
        setIsCreatingVault(true);
        setShowPassphraseDialog(true);
      } else {
        // Existing user - show unlock passphrase dialog
        setIsCreatingVault(false);
        setShowPassphraseDialog(true);
      }
      
      setLoading(false);
      
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to sign in');
      setLoading(false);
    }
  }

  async function handlePassphraseSubmit(passphrase: string) {
    setLoading(true);
    
    try {
      if (isCreatingVault) {
        // Create new vault
        console.log('🔑 Creating vault...');
        const vaultSetup = await createVault(passphrase);
        
        // Store vault on server
        const setupResponse = await fetch('/api/vault/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: tempUserId,
            encryptedVaultKey: vaultSetup.encryptedVaultKey,
            salt: vaultSetup.salt,
            iv: vaultSetup.iv,
            authTag: vaultSetup.authTag
          })
        });
        
        if (!setupResponse.ok) {
          throw new Error('Failed to create vault');
        }
        
        // Store vault key in session
        sessionStorage.setItem('vault_key', vaultSetup.vaultKeyHex);
        
        // Show recovery key dialog
        setRecoveryKey(vaultSetup.backupKey);
        setShowPassphraseDialog(false);
        setShowRecoveryKeyDialog(true);
        
      } else {
        // Unlock existing vault
        console.log('🔓 Unlocking vault...');
        const vaultDataResponse = await fetch(`/api/vault/get?userId=${tempUserId}`);
        
        if (!vaultDataResponse.ok) {
          throw new Error('Failed to retrieve vault data');
        }
        
        const vaultData = await vaultDataResponse.json();
        
        try {
          const vaultKey = await unlockVault(passphrase, {
            encryptedVaultKey: vaultData.encryptedVaultKey,
            salt: vaultData.salt,
            iv: vaultData.iv,
            authTag: vaultData.authTag
          });
          
          // Store vault key in session
          sessionStorage.setItem('vault_key', vaultKey);
          
          setShowPassphraseDialog(false);
          
          // Redirect to dashboard (not food subdirectory)
          console.log('✅ Vault unlocked, redirecting...');
          router.push('/dashboard');
          
        } catch (unlockError: any) {
          // Wrong passphrase - show user-friendly error
          setError('Incorrect passphrase. Please try again.');
          setShowPassphraseDialog(false);
          throw new Error('Incorrect passphrase');
        }
      }
      
      setLoading(false);
      
    } catch (error: any) {
      console.error('Vault error:', error);
      setError(error.message || 'Failed to process vault');
      setShowPassphraseDialog(false);
      setLoading(false);
    }
  }

  function handleRecoveryKeyContinue() {
    setShowRecoveryKeyDialog(false);
    // Redirect to setup preferences
    router.push('/dashboard/food/setup');
  }

  function handlePassphraseCancel() {
    setShowPassphraseDialog(false);
    setError('Login cancelled');
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-400 dark:to-gray-600 flex items-center justify-center text-4xl shadow-lg">
              🤫
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-gray-300 dark:to-gray-500 bg-clip-text text-transparent">
            Welcome to Hushh
          </h1>
          <p className="text-muted-foreground text-lg">
            Your Privacy-First Personal Data Assistant
          </p>
        </div>

        {/* Login Card */}
        <Card className="glass border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Securely access your encrypted personal data vault
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              size="lg"
              className="w-full bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600"
            >
              {loading ? (
                <>
                  <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-medium">Continue with Google</span>
                </>
              )}
            </Button>

            {/* Features */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-green-500" />
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-blue-500" />
                <span>Your data, your control</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Key className="h-4 w-4 text-purple-500" />
                <span>Zero-knowledge architecture</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our{' '}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
        </p>
      </div>

      {/* Dialogs */}
      <PassphraseDialog
        open={showPassphraseDialog}
        isCreating={isCreatingVault}
        onConfirm={handlePassphraseSubmit}
        onCancel={handlePassphraseCancel}
      />

      <RecoveryKeyDialog
        open={showRecoveryKeyDialog}
        recoveryKey={recoveryKey}
        onContinue={handleRecoveryKeyContinue}
      />
    </main>
  );
}
