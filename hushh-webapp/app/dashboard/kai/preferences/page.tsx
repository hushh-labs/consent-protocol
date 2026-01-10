"use client";

/**
 * Kai Preferences Page
 *
 * Shows user's stored preferences from vault_kai:
 * - Confirmed investor profile (if any)
 * - Risk profile
 * - Processing mode
 * - Simulate VIP onboarding by selecting investor profile
 *
 * All data is E2E encrypted - decrypted client-side with vault key.
 * Uses morphy-ux components per frontend-design-system.md.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Shield,
  Cpu,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronRight,
  TrendingUp,
  Scale,
  Search,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/lib/morphy-ux/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { VaultService } from "@/lib/services/vault-service";
import {
  IdentityService,
  InvestorMatch,
  InvestorProfile,
  IdentityStatusResult,
} from "@/lib/services/identity-service";
import { getPreferences } from "@/lib/services/kai-service";
import { HushhVault } from "@/lib/capacitor";

export default function KaiPreferences() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVaultUnlocked, vaultKey } = useVault();

  const [loading, setLoading] = useState(true);
  const [identityStatus, setIdentityStatus] =
    useState<IdentityStatusResult | null>(null);
  const [riskProfile, setRiskProfile] = useState<string | null>(null);
  const [processingMode, setProcessingMode] = useState<string | null>(null);
  const [vaultOwnerToken, setVaultOwnerToken] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Profile selection state
  const [showProfileSearch, setShowProfileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvestorMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<InvestorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Get VAULT_OWNER token on mount
  useEffect(() => {
    async function getToken() {
      if (!user?.uid || !isVaultUnlocked) return;

      try {
        const { auth } = await import("@/lib/firebase/config");
        const firebaseToken = await auth.currentUser?.getIdToken(true);
        if (firebaseToken) {
          const result = await VaultService.issueVaultOwnerToken(
            user.uid,
            firebaseToken
          );
          setVaultOwnerToken(result.token);
        }
      } catch (error) {
        console.error("[Preferences] Failed to get token:", error);
      }
    }

    getToken();
  }, [user, isVaultUnlocked]);

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.uid || !vaultKey || !vaultOwnerToken) return;

      setLoading(true);
      try {
        // Get identity status
        const identity = await IdentityService.getIdentityStatus(
          vaultOwnerToken
        );
        setIdentityStatus(identity);

        // Get Kai preferences (encrypted)
        const { preferences } = await getPreferences(user.uid);

        // Decrypt each preference
        for (const pref of preferences) {
          const decrypted = await HushhVault.decryptData({
            keyHex: vaultKey,
            payload: {
              ciphertext: pref.ciphertext,
              iv: pref.iv,
              tag: pref.tag || "",
              encoding: "base64",
              algorithm: "aes-256-gcm",
            },
          });

          if (pref.field_name === "kai_risk_profile") {
            setRiskProfile(decrypted.plaintext);
          } else if (pref.field_name === "kai_processing_mode") {
            setProcessingMode(decrypted.plaintext);
          }
        }
      } catch (error) {
        console.error("[Preferences] Load error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user, vaultKey, vaultOwnerToken]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;

    setSearching(true);
    try {
      const results = await IdentityService.searchInvestors(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("[Preferences] Search error:", error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Select profile
  const handleSelectProfile = async (match: InvestorMatch) => {
    setLoadingProfile(true);
    try {
      const profile = await IdentityService.getInvestorProfile(match.id);
      if (profile) {
        setSelectedProfile(profile);
      }
    } catch (error) {
      console.error("[Preferences] Load profile error:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  // Confirm profile
  const handleConfirmProfile = async () => {
    if (!selectedProfile || !vaultKey || !vaultOwnerToken) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      // Encrypt the profile data
      const profileJson = JSON.stringify({
        id: selectedProfile.id,
        name: selectedProfile.name,
        firm: selectedProfile.firm,
        title: selectedProfile.title,
        aum_billions: selectedProfile.aum_billions,
        investment_style: selectedProfile.investment_style,
        risk_tolerance: selectedProfile.risk_tolerance,
        time_horizon: selectedProfile.time_horizon,
        top_holdings: selectedProfile.top_holdings,
        sector_exposure: selectedProfile.sector_exposure,
        public_quotes: selectedProfile.public_quotes,
        biography: selectedProfile.biography,
      });

      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: profileJson,
      });

      // Send to backend
      const result = await IdentityService.confirmIdentity(
        selectedProfile.id,
        {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
        },
        vaultOwnerToken
      );

      if (result.success) {
        toast.success(`Profile loaded: ${selectedProfile.name}`);
        setIdentityStatus({
          has_confirmed_identity: true,
          confirmed_at: new Date().toISOString(),
          investor_name: selectedProfile.name,
          investor_firm: selectedProfile.firm,
        });
        setShowProfileSearch(false);
        setSelectedProfile(null);
        setSearchResults([]);
        setSearchQuery("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("[Preferences] Confirm error:", error);
      toast.error("Failed to confirm profile");
    } finally {
      setConfirming(false);
    }
  };

  // Reset identity handler
  const handleResetIdentity = async () => {
    if (!vaultOwnerToken) return;

    setResetting(true);
    try {
      const result = await IdentityService.resetIdentity(vaultOwnerToken);
      if (result.success) {
        setIdentityStatus({
          has_confirmed_identity: false,
          confirmed_at: null,
          investor_name: null,
          investor_firm: null,
        });
        toast.success("Identity reset successfully");
      }
    } catch (error) {
      console.error("[Preferences] Reset error:", error);
      toast.error("Failed to reset identity");
    } finally {
      setResetting(false);
    }
  };

  // Risk profile icon mapping
  const getRiskIcon = (profile: string) => {
    switch (profile) {
      case "conservative":
        return <Shield className="w-5 h-5 text-blue-500" />;
      case "balanced":
        return <Scale className="w-5 h-5 text-purple-500" />;
      case "aggressive":
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  if (!isVaultUnlocked) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card variant="none" effect="glass" className="border-0 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="w-12 h-12 text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vault Locked</h2>
            <p className="text-muted-foreground text-center">
              Please unlock your vault to view preferences
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="none"
          effect="glass"
          size="icon-sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Kai Preferences</h1>
          <p className="text-muted-foreground text-sm">
            Your encrypted investment profile
          </p>
        </div>
      </div>

      {loading ? (
        <Card variant="none" effect="glass" className="border-0 shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Investor Profile Card */}
          <Card variant="none" effect="glass" className="border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Investor Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {identityStatus?.has_confirmed_identity ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-linear-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                    <h3 className="font-bold text-lg">
                      {identityStatus.investor_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {identityStatus.investor_firm}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Confirmed:{" "}
                      {new Date(
                        identityStatus.confirmed_at!
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="none"
                      effect="glass"
                      size="sm"
                      onClick={() => setShowProfileSearch(true)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Change
                    </Button>
                    <Button
                      variant="none"
                      effect="glass"
                      size="sm"
                      onClick={handleResetIdentity}
                      disabled={resetting}
                      className="text-red-500 hover:text-red-600"
                    >
                      {resetting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    No investor profile linked
                  </p>
                  <Button
                    variant="gradient"
                    effect="glass"
                    size="sm"
                    onClick={() => setShowProfileSearch(true)}
                    showRipple
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Select Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Simulate VIP Onboarding Section */}
          {showProfileSearch && (
            <Card variant="none" effect="glass" className="border-0 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Simulate VIP Onboarding
                </CardTitle>
                <CardDescription>
                  Select an investor profile to pre-load preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile Preview */}
                {selectedProfile ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-linear-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-6 h-6 text-purple-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">
                            {selectedProfile.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedProfile.title} @ {selectedProfile.firm}
                          </p>
                          {selectedProfile.aum_billions && (
                            <p className="text-xs text-muted-foreground mt-1">
                              AUM: ${selectedProfile.aum_billions}B
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedProfile.investment_style && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            INVESTMENT STYLE
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedProfile.investment_style.map((style) => (
                              <span
                                key={style}
                                className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400"
                              >
                                {style}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="none"
                        effect="glass"
                        className="flex-1"
                        onClick={() => setSelectedProfile(null)}
                        disabled={confirming}
                      >
                        Back
                      </Button>
                      <Button
                        variant="gradient"
                        effect="glass"
                        className="flex-1"
                        onClick={handleConfirmProfile}
                        disabled={confirming}
                        showRipple
                      >
                        {confirming ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {confirming ? "Loading..." : "Load Profile"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search investor name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="glass-interactive"
                      />
                      <Button
                        variant="gradient"
                        effect="glass"
                        onClick={handleSearch}
                        disabled={searching}
                        showRipple
                      >
                        {searching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Results */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {searchResults.map((match) => (
                        <button
                          key={match.id}
                          onClick={() => handleSelectProfile(match)}
                          disabled={loadingProfile}
                          className="w-full p-3 rounded-lg glass-interactive flex items-center gap-3 text-left transition-all hover:bg-primary/5"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">
                              {match.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {match.firm}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>

                    {/* Cancel */}
                    <Button
                      variant="none"
                      effect="glass"
                      className="w-full"
                      onClick={() => setShowProfileSearch(false)}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Risk Profile Card */}
          <Card variant="none" effect="glass" className="border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {riskProfile && getRiskIcon(riskProfile)}
                Risk Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {riskProfile ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="capitalize font-medium">{riskProfile}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <p className="text-muted-foreground">Not set</p>
              )}
            </CardContent>
          </Card>

          {/* Processing Mode Card */}
          <Card variant="none" effect="glass" className="border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Processing Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              {processingMode ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="capitalize font-medium">
                    {processingMode === "hybrid" ? "Hybrid Cloud" : "On-Device"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <p className="text-muted-foreground">Not set</p>
              )}
            </CardContent>
          </Card>

          {/* Back to Analysis */}
          <Link href="/dashboard/kai/analysis">
            <Button variant="none" effect="glass" className="w-full" showRipple>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analysis
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
