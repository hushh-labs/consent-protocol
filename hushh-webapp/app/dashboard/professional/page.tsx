"use client";

/**
 * Professional Profile Dashboard
 *
 * Displays user's encrypted professional profile data.
 * Data is decrypted client-side, showing skills, experience, job preferences.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decryptData, EncryptedPayload } from "@/lib/vault/encrypt";
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";
import { getSessionItem } from "@/lib/utils/session-storage";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import {
  User,
  Briefcase,
  Code,
  Target,
  TrendingUp,
  Shield,
  Edit,
  RefreshCw,
} from "lucide-react";

interface ProfessionalProfile {
  professional_title: string;
  skills: string[];
  experience_level: string;
  job_preferences: string[];
}

export default function ProfessionalProfilePage() {
  const router = useRouter();
  const { getVaultKey, isVaultUnlocked } = useVault();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Redirect if vault not unlocked
    if (!isVaultUnlocked) {
      router.push("/dashboard");
      return;
    }
    loadProfile();
  }, [isVaultUnlocked]);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const vaultKey = getVaultKey();
      if (!vaultKey) {
        setError("Vault not unlocked");
        return;
      }

      const userId =
        localStorage.getItem("user_id") || getSessionItem("user_id");
      if (!userId) {
        setError("No user ID found");
        return;
      }

      // Get session token from platform-aware storage
      // const sessionToken = getSessionItem("session_token"); // Removed as per diff
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 [ProfDashboard] Loading profile. UserId: ${userId}`);
      }

      // Use ApiService for platform-aware API calls
      const response = await ApiService.getProfessionalProfile(userId);
      if (!response.ok) {
        if (response.status === 404) {
          // No profile yet, show empty state
          setProfile(null);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      const encryptedPrefs = data.preferences || {};

      // Decrypt client-side
      if (process.env.NODE_ENV === "development") {
        console.log("🔓 Decrypting professional profile...");
      }

      // Try to decrypt each field if it exists
      let profileData: ProfessionalProfile = {
        professional_title: "",
        skills: [],
        experience_level: "",
        job_preferences: [],
      };

      if (encryptedPrefs.professional_title) {
        try {
          const titleDecrypted = await decryptData(
            encryptedPrefs.professional_title as EncryptedPayload,
            vaultKey
          );
          profileData.professional_title = JSON.parse(titleDecrypted);
        } catch (e) {
          console.warn("Failed to decrypt professional_title", e);
        }
      }

      if (encryptedPrefs.skills) {
        try {
          const skillsDecrypted = await decryptData(
            encryptedPrefs.skills as EncryptedPayload,
            vaultKey
          );
          profileData.skills = JSON.parse(skillsDecrypted);
        } catch (e) {
          console.warn("Failed to decrypt skills", e);
        }
      }

      if (encryptedPrefs.experience_level) {
        try {
          const expDecrypted = await decryptData(
            encryptedPrefs.experience_level as EncryptedPayload,
            vaultKey
          );
          profileData.experience_level = JSON.parse(expDecrypted);
        } catch (e) {
          console.warn("Failed to decrypt experience_level", e);
        }
      }

      if (encryptedPrefs.job_preferences) {
        try {
          const jobDecrypted = await decryptData(
            encryptedPrefs.job_preferences as EncryptedPayload,
            vaultKey
          );
          profileData.job_preferences = JSON.parse(jobDecrypted);
        } catch (e) {
          console.warn("Failed to decrypt job_preferences", e);
        }
      }

      setProfile(profileData);
    } catch (err: unknown) {
      console.error("Profile load error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-linear-to-br from-blue-400 to-purple-500 mx-auto flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <RefreshCw className="h-5 w-5 animate-spin absolute -bottom-1 -right-1 text-blue-600 bg-white rounded-full p-0.5" />
          </div>
          <p className="text-muted-foreground">Unlocking your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md" variant="none" effect="glass">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-linear-to-br from-blue-400 to-purple-500 mx-auto flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <p className="text-destructive font-medium">{error}</p>
            <Button onClick={() => router.push("/")} variant="gradient">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md" variant="none" effect="glass">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-linear-to-br from-blue-400 to-purple-500 mx-auto flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold">No Profile Yet</h2>
            <p className="text-muted-foreground">
              Set up your professional profile to share your skills, title, and
              job preferences to help us match you with opportunities.
            </p>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="gradient"
              effect="fill"
              size="lg"
            >
              <User className="h-4 w-4 mr-2" />
              Set Up Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-lg">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Professional Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your encrypted career data
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push("/dashboard")}
          variant="none"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title Card */}
        <Card variant="none" effect="glass" className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Professional Title
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {profile.professional_title}
            </p>
          </CardContent>
        </Card>

        {/* Skills Card */}
        <Card variant="none" effect="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-emerald-500" />
              Skills ({profile.skills.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Experience Card */}
        <Card variant="none" effect="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Experience Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{profile.experience_level}</p>
          </CardContent>
        </Card>

        {/* Job Preferences Card */}
        <Card variant="none" effect="glass" className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              Looking For
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.job_preferences.map((pref, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm"
                >
                  {pref}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button onClick={() => router.push("/dashboard")} variant="blue">
          <Edit className="h-4 w-4 mr-2" />
          Update Profile
        </Button>
        <Button onClick={loadProfile} variant="none">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
