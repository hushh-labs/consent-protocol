"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/lib/morphy-ux/morphy";
import { Shield, Lock, Key, ArrowRight, AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { AuthService } from "@/lib/services/auth-service";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRedirectResult, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/firebase/auth-context";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import { isAppReviewMode, REVIEWER_EMAIL, REVIEWER_PASSWORD } from "@/lib/config";
import { isAndroid } from "@/lib/capacitor/platform";
import { KaiOnboardingFlow } from "@/components/kai/kai-onboarding-flow";

// Global utility for resetting welcome screen (accessible from browser console)
if (typeof window !== "undefined") {
  (window as any).resetWelcomeScreen = () => {
    localStorage.removeItem("hushh_has_visited");
    console.log("✅ Welcome screen reset. Refreshing...");
    window.location.href = "/";
  };
}

// --- Shared Components ---
function SharedHeader() {
  return (
    <div className="text-center space-y-5">
      <h1
        className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent"
        style={{
          backgroundImage: "linear-gradient(to right, #e91e63, #9c27b0)",
        }}
      >
        Welcome to
      </h1>

      <div className="mx-auto h-24 w-auto flex items-center justify-center">
        <img
          src="/hushh-logo-new.svg"
          alt="Hushh Logo"
          className="h-full w-auto object-contain dark:brightness-0 dark:invert"
        />
      </div>

      <p className="text-xl font-bold text-muted-foreground leading-tight">
        Your Personal Agent. <br />
        <span className="text-base font-medium opacity-70">Private. Secure. Yours.</span>
      </p>
    </div>
  );
}

// --- Welcome Component for First-Time Users ---
function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Unified Header */}
        <SharedHeader />

        {/* Feature Information - Refining Scale */}
        <div className="space-y-6 px-10 py-2">
          {/* Kai Feature */}
          <div className="flex items-center gap-5">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 shadow-lg shadow-purple-500/5">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-extrabold text-lg tracking-tight">Meet Kai</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Your AI Investment Advisor. Analyzes your portfolio privately.
              </p>
            </div>
          </div>

          {/* E2EE Feature */}
          <div className="flex items-center gap-5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
              <Shield className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-extrabold text-lg tracking-tight">End-to-End Encrypted</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Your data is encrypted on your device. Only you hold the keys.
              </p>
            </div>
          </div>

          {/* Control Feature */}
          <div className="flex items-center gap-5">
            <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 shadow-lg shadow-blue-500/5">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-extrabold text-lg tracking-tight">Total Control</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Grant and revoke access to your data with granular precision.
              </p>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="pt-2 px-2">
          <Button
            variant="gradient"
            size="lg"
            className="w-full h-12 text-base shadow-lg shadow-blue-500/20 rounded-xl"
            onClick={onGetStarted}
            showRipple
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}

// --- Main Login Logic ---
function LoginScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/kai";

  // State
  const [error, setError] = useState<string | null>(null);

  // Use Reactive Auth State
  const { user, loading: authLoading, setNativeUser } = useAuth();
  const { registerSteps, completeStep, reset } = useStepProgress();

  // Register 1 step: Auth state check
  useEffect(() => {
    registerSteps(1);
    return () => reset();
  }, [registerSteps, reset]);

  useEffect(() => {
    // If loading, do nothing yet
    if (authLoading) return;

    // Step 1: Auth check complete
    completeStep();

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
  }, [redirectPath, user, authLoading, completeStep]); // FIXED: Removed router/setNativeUser - stable refs

  // Show spinner while checking session OR if user authenticated (while redirecting)
  if (authLoading || user) {
    return null;
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

  const handleAppleLogin = async () => {
    try {
      setError(null);
      // signInWithApple returns the user directly
      const authResult = await AuthService.signInWithApple();
      const user = authResult.user;

      console.log("[Login] signInWithApple returned user:", user?.uid);

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
        console.error("[Login] No user returned from signInWithApple");
        setError("Login succeeded but no user returned");
      }
    } catch (err: any) {
      console.error("Apple Login failed:", err);
      // Don't show error for user cancellation
      if (!err.message?.includes("cancelled") && !err.message?.includes("canceled")) {
        setError(err.message || "Failed to sign in with Apple");
      }
    }
  };

  const handleReviewerLogin = async () => {
    try {
      setError(null);
      console.log("[Login] Reviewer login initiated");

      // Sign in with email/password using dedicated test account
      const authResult = await signInWithEmailAndPassword(
        auth,
        REVIEWER_EMAIL,
        REVIEWER_PASSWORD
      );
      const user = authResult.user;

      console.log("[Login] Reviewer login returned user:", user?.uid);

      if (user) {
        // Persist user_id for downstream pages
        localStorage.setItem("user_id", user.uid);
        sessionStorage.setItem("user_id", user.uid);
        // Mark as reviewer mode for optional UI customization
        localStorage.setItem("hushh_reviewer_mode", "true");

        // IMMEDIATE REDIRECT
        console.log("[Login] Navigating to:", redirectPath);

        // CRITICAL: Manually set user in context to avoid race condition
        setNativeUser(user);

        router.push(redirectPath);
      } else {
        console.error("[Login] No user returned from reviewer login");
        setError("Reviewer login failed - no user returned");
      }
    } catch (err: any) {
      console.error("Reviewer login failed:", err);
      setError(err.message || "Failed to sign in as reviewer");
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header - Shared for seamless transition */}
        <SharedHeader />

        {/* Main Login Content */}
        <div className="p-2 space-y-4">
          {/* Review Mode Alert */}
          {/* Review Mode Alert */}
          {isAppReviewMode() && (
            <Card variant="none" effect="glass" className="border-yellow-500/30">
              <CardContent className="flex items-center gap-3 p-3 text-sm font-medium">
                <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                <span>App Review Mode Active - Reviewer test account available below</span>
              </CardContent>
            </Card>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* Login Buttons */}
          <div className="space-y-6">
            <div className="space-y-6">
              {/* Platform-aware order: Apple first (iOS/Web), Google first (Android) */}
              {isAndroid() ? (
                <>
                  {/* Google Button - First on Android */}
                  <Button
                    variant="link"
                    effect="glass"
                    className="w-full h-14 rounded-xl text-base"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
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
                    Continue with Google
                  </Button>

                  {/* Apple Button - Second on Android */}
                  <Button
                    variant="link"
                    effect="glass"
                    className="w-full h-14 rounded-xl text-base"
                    onClick={handleAppleLogin}
                  >
                    <svg
                      className="w-5 h-5 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.07-.51-3.2 0-1.01.43-2.1.49-2.98-.38C5.22 17.63 2.7 12 5.45 8.04c1.47-2.09 3.8-2.31 5.33-1.18 1.1.75 3.3.73 4.45-.04 2.1-1.31 3.55-.95 4.5 1.14-.15.08.2.14 0 .2-2.63 1.34-3.35 6.03.95 7.84-.46 1.4-1.25 2.89-2.26 4.4l-.07.08-.05-.2zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.22-1.8 4.19-3.74 4.25z" />
                    </svg>
                    Continue with Apple
                  </Button>
                </>
              ) : (
                <>
                  {/* Apple Button - First on iOS/Web */}
                  <Button
                    variant="link"
                    effect="glass"
                    size="xl"
                    fullWidth
                    className="rounded-xl"
                    onClick={handleAppleLogin}
                  >
                    <svg
                      className="w-5 h-5 mr-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.07-.51-3.2 0-1.01.43-2.1.49-2.98-.38C5.22 17.63 2.7 12 5.45 8.04c1.47-2.09 3.8-2.31 5.33-1.18 1.1.75 3.3.73 4.45-.04 2.1-1.31 3.55-.95 4.5 1.14-.15.08.2.14 0 .2-2.63 1.34-3.35 6.03.95 7.84-.46 1.4-1.25 2.89-2.26 4.4l-.07.08-.05-.2zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.22-1.8 4.19-3.74 4.25z" />
                    </svg>
                    Continue with Apple
                  </Button>

                  {/* Google Button - Second on iOS/Web */}
                  <Button
                    variant="link"
                    effect="glass"
                    size="xl"
                    fullWidth
                    className="rounded-xl"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
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
                    Continue with Google
                  </Button>
                </>
              )}

              {/* Reviewer Button - Only shown in APP_REVIEW_MODE */}
              {isAppReviewMode() && (
                <Button
                  variant="link"
                  effect="glass"
                  size="xl"
                  fullWidth
                  className="rounded-xl"
                  onClick={handleReviewerLogin}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Continue as Reviewer
                </Button>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground/60">
              By continuing, you agree to our Terms of Service and Privacy
              Policy. Your vault is encrypted on-device.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// Suspense wrap for search params
function LoginScreen() {
  return (
    <Suspense
      fallback={
        <HushhLoader label="Loading..." variant="fullscreen" />
      }
    >
      <LoginScreenContent />
    </Suspense>
  );
}

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true);

  const handleGetStarted = () => {
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <WelcomeScreen onGetStarted={handleGetStarted} />;
  }

  return <LoginScreen />;
}
