"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/lib/morphy-ux/morphy";
import {
  Shield,
  Lock,
  Key,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AuthService } from "@/lib/services/auth-service";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth-context";

// --- Welcome Component for First-Time Users ---
function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Standard App Background inherited from layout */}

      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header / Logo */}
        <div className="text-center space-y-6">
          <h1
            className="text-4xl font-bold tracking-tight bg-clip-text text-transparent mb-6"
            style={{
              backgroundImage: "linear-gradient(to right, #e91e63, #9c27b0)",
            }}
          >
            Welcome to
          </h1>

          <div className="mx-auto h-24 w-auto flex items-center justify-center mb-2">
            <img
              src="/hushh-logo-new.svg"
              alt="Hushh Logo"
              className="h-full w-auto object-contain dark:brightness-0 dark:invert"
            />
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed text-balance">
            Your personal data assistant. <br />
            Private. Secure. Yours.
          </p>
        </div>

        {/* Feature Cards Carousel / Stack */}
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">
                End-to-End Encrypted
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your data is encrypted on your device. Only you hold the keys.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Total Control</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Grant and revoke access to your data with granular precision.
              </p>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="pt-4">
          <Button
            variant="gradient"
            size="xl"
            className="w-full h-14 text-lg shadow-lg shadow-blue-500/25 rounded-2xl"
            onClick={onGetStarted}
            showRipple
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Read our{" "}
            <Link href="/docs" className="underline hover:text-foreground">
              documentation
            </Link>{" "}
            to learn more.
          </p>
        </div>
      </div>
    </main>
  );
}

// --- Main Login Logic ---
function LoginScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // State
  const [error, setError] = useState<string | null>(null);

  // Use Reactive Auth State
  const { user, loading: authLoading, setNativeUser } = useAuth();

  useEffect(() => {
    // If loading, do nothing yet
    if (authLoading) return;

    // Check pending redirects from Google Sign-In
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log(
            "[Login] Redirect result found, navigating to:",
            redirectPath
          );
          // Manually update context to prevent race conditions
          setNativeUser(result.user);
          router.push(redirectPath);
        }
      })
      .catch((err) => {
        console.error("Redirect auth error:", err);
      });

    // Check active session
    if (user) {
      console.log("[Login] User authenticated, navigating to:", redirectPath);
      router.push(redirectPath);
    }
  }, [redirectPath, user, authLoading]); // FIXED: Removed router/setNativeUser - stable refs

  // Show spinner while checking session OR if user authenticated (while redirecting)
  if (authLoading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      // signInWithGoogle returns the user directly
      const authResult = await AuthService.signInWithGoogle();
      const user = authResult.user;

      console.log("[Login] signInWithGoogle returned user:", user?.uid);

      if (user) {
        // Persist user_id for downstream pages
        localStorage.setItem("user_id", user.uid);
        sessionStorage.setItem("user_id", user.uid);

        // IMMEDIATE REDIRECT
        console.log("[Login] Navigating to:", redirectPath);

        // CRITICAL: Manually set user in context to avoid race condition
        // where VaultLockGuard on dashboard sees 'null' before Context updates
        setNativeUser(user);

        router.push(redirectPath);
      } else {
        console.error("[Login] No user returned from signInWithGoogle");
        setError("Login succeeded but no user returned");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "Failed to sign in");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header - Shown only for Login state */}
        <div className="text-center space-y-4 pt-8">
          <>
            <div className="flex justify-center gap-3 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Login</h1>
            <p className="text-lg text-muted-foreground max-w-xs mx-auto text-balance">
              Take control of your digital identity. Secure. Private. Yours.
            </p>
          </>
        </div>

        {/* Main Login Content */}
        <div className="p-2 space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* Login Buttons */}
          <div className="space-y-6">
            <div className="space-y-4">
              <Button
                variant="none"
                className="w-full bg-white text-black hover:bg-gray-100 border border-gray-200 h-12 rounded-xl shadow-sm transition-all relative overflow-hidden group"
                onClick={handleGoogleLogin}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <Button
                variant="none"
                disabled
                className="w-full bg-black text-white border border-gray-800 h-12 rounded-xl shadow-sm transition-all opacity-80 cursor-not-allowed dark:bg-white dark:text-black"
              >
                <svg
                  className="w-5 h-5 mr-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.07-.51-3.2 0-1.01.43-2.1.49-2.98-.38C5.22 17.63 2.7 12 5.45 8.04c1.47-2.09 3.8-2.31 5.33-1.18 1.1.75 3.3.73 4.45-.04 2.1-1.31 3.55-.95 4.5 1.14-.15.08.2.14 0 .2-2.63 1.34-3.35 6.03.95 7.84-.46 1.4-1.25 2.89-2.26 4.4l-.07.08-.05-.2zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.22-1.8 4.19-3.74 4.25z" />
                </svg>
                Continue with Apple (Soon)
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground/60">
              By continuing, you agree to our Terms of Service and Privacy
              Policy. Your vault is encrypted on-device.
            </p>
          </div>
        </div>

        {/* Security Features */}
        <Card variant="none" effect="glass" className="bg-muted/30">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-green-500" />
                <span>End-to-end encrypted vault</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-blue-500" />
                <span>PBKDF2 + AES-256-GCM encryption</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Key className="h-4 w-4 text-purple-500" />
                <span>Zero-knowledge architecture</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// Suspense wrap for search params
function LoginScreen() {
  return (
    <Suspense
      fallback={
        <div className="flex center h-screen">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <LoginScreenContent />
    </Suspense>
  );
}

export default function Home() {
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    // Check local storage
    const hasVisited = localStorage.getItem("hushh_has_visited");
    if (hasVisited) {
      setShowWelcome(false);
    } else {
      setShowWelcome(true);
    }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem("hushh_has_visited", "true");
    setShowWelcome(false);
  };

  if (showWelcome === null) return null;

  if (showWelcome) {
    return <WelcomeScreen onGetStarted={handleGetStarted} />;
  }

  return <LoginScreen />;
}
