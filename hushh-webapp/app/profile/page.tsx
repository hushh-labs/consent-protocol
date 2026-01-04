"use client";

/**
 * Profile Page
 *
 * Shows user info from Google login, sign out button, and theme toggle.
 * Mobile-first design with Morphy-UX styling.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@/lib/morphy-ux/morphy";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { User, Mail, LogOut, Shield } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Redirect to login if not authenticated (in useEffect to avoid render error)
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Show nothing while checking auth or if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg space-y-6">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt="Profile"
            className="h-24 w-24 rounded-full mx-auto ring-4 ring-primary/20"
          />
        ) : (
          <div className="h-24 w-24 rounded-full mx-auto bg-muted flex items-center justify-center ring-4 ring-primary/20">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{user?.displayName || "User"}</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Account Info Card */}
      <Card variant="none" effect="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span>Account</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Email */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || "Not available"}
              </p>
            </div>
          </div>

          {/* Provider */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Sign-in Provider</p>
              <p className="text-xs text-muted-foreground">Google</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card variant="none" effect="glass">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <Button
        variant="none"
        size="lg"
        className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        <LogOut className="h-5 w-5 mr-2" />
        Sign Out
      </Button>

      {/* Security Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Your data is encrypted end-to-end and never leaves your device
        unencrypted.
      </p>
    </div>
  );
}
