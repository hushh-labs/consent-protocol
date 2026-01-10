"use client";

/**
 * Kai Preferences Page - Compact & Elegant
 *
 * Shows user's investment profile and key KPIs in a streamlined layout:
 * - Investor profile with key metrics (AUM, style, risk, holdings)
 * - Risk profile & processing mode inline
 * - VIP profile search modal
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
  TrendingUp,
  Scale,
  Search,
  Check,
  Sparkles,
  Briefcase,
  PieChart,
  Clock,
  DollarSign,
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
  const { vaultOwnerToken } = useVault();
  const [resetting, setResetting] = useState(false);

  // Profile selection modal state
  const [showProfileSearch, setShowProfileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvestorMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<InvestorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.uid || !vaultKey || !vaultOwnerToken) return;

      setLoading(true);
      try {
        const { getEncryptedProfile } = await import(
          "@/lib/services/kai-service"
        );
        const encryptedProfile = await getEncryptedProfile(vaultOwnerToken);

        if (encryptedProfile && encryptedProfile.profile_data) {
          const decryptedData = await HushhVault.decryptData({
            keyHex: vaultKey,
            payload: {
              ciphertext: encryptedProfile.profile_data.ciphertext,
              iv: encryptedProfile.profile_data.iv,
              tag: encryptedProfile.profile_data.tag || "",
              encoding: "base64",
              algorithm: "aes-256-gcm",
            },
          });
          const profile: InvestorProfile = JSON.parse(decryptedData.plaintext);

          setIdentityStatus({
            has_confirmed_identity: true,
            confirmed_at: encryptedProfile.confirmed_at,
            investor_name: profile.name,
            investor_firm: profile.firm,
          });
          setSelectedProfile(profile); // Reuse state to store full profile
        }

        const { preferences } = await getPreferences(user.uid);

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

  const handleConfirmProfile = async () => {
    if (!selectedProfile || !vaultKey || !vaultOwnerToken) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      const profileJson = JSON.stringify(selectedProfile);
      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: profileJson,
      });

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

  // KPI badges for investor profiles
  const KPIBadge = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: typeof TrendingUp;
    label: string;
    value: string;
    color: string;
  }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
      <Icon className="w-4 h-4" />
      <div className="text-xs">
        <div className="opacity-70">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );

  if (!isVaultUnlocked) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card variant="none" effect="glass" className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Shield className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              Unlock vault to view preferences
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="none"
          effect="glass"
          size="icon-sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Preferences</h1>
      </div>

      {loading ? (
        <Card variant="none" effect="glass" className="border-0">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Investor Profile - Compact KPI Display */}
          <Card
            variant="none"
            effect="glass"
            className="border-0 overflow-hidden"
          >
            <CardContent className="p-4">
              {identityStatus?.has_confirmed_identity ? (
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold">
                          {identityStatus.investor_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {identityStatus.investor_firm}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="none"
                      effect="glass"
                      size="icon-sm"
                      onClick={handleResetIdentity}
                      disabled={resetting}
                      className="text-red-500"
                    >
                      {resetting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* KPI Grid - 2x2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <KPIBadge
                      icon={Scale}
                      label="Risk"
                      value={riskProfile || "Balanced"}
                      color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    />
                    <KPIBadge
                      icon={TrendingUp}
                      label="Style"
                      value={selectedProfile?.investment_style?.[0] || "Value"}
                      color="bg-green-500/10 text-green-600 dark:text-green-400"
                    />
                    <KPIBadge
                      icon={Clock}
                      label="Horizon"
                      value={selectedProfile?.time_horizon || "Long-term"}
                      color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    />
                    <KPIBadge
                      icon={Cpu}
                      label="Mode"
                      value={
                        processingMode === "hybrid" ? "Hybrid" : "On-Device"
                      }
                      color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    />
                  </div>

                  {/* DETAILS VAULT VIEW */}
                  {selectedProfile && (
                    <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          Captured Metrics (Decrypted)
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground uppercase text-[10px] tracking-wider mb-1">
                            AUM
                          </p>
                          <p className="font-mono">
                            ${selectedProfile.aum_billions}B
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase text-[10px] tracking-wider mb-1">
                            Public Quotes
                          </p>
                          <p className="font-mono">
                            {selectedProfile.public_quotes?.length || 0} Quotes
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Investment Style
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedProfile.investment_style?.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Sector Exposure
                        </p>
                        <div className="space-y-1">
                          {selectedProfile.sector_exposure &&
                            Object.entries(selectedProfile.sector_exposure)
                              .slice(0, 3)
                              .map(([sector, pct]) => (
                                <div
                                  key={sector}
                                  className="flex items-center justify-between text-[10px]"
                                >
                                  <span>{sector}</span>
                                  <span className="font-mono text-primary">
                                    {(Number(pct) * 100).toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-muted-foreground uppercase text-[10px] tracking-wider">
                          Top Holdings
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedProfile.top_holdings
                            ?.slice(0, 5)
                            .map((h: any) => (
                              <span
                                key={h.ticker}
                                className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-mono border border-blue-500/20"
                              >
                                {h.ticker}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Change Profile Link */}
                  <button
                    onClick={() => setShowProfileSearch(true)}
                    className="w-full text-xs text-primary hover:underline text-center py-2"
                  >
                    Change investor profile
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    No investor profile linked
                  </p>
                  <Button
                    variant="gradient"
                    effect="glass"
                    size="sm"
                    onClick={() => setShowProfileSearch(true)}
                    showRipple
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Load VIP Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Search Modal */}
          {showProfileSearch && (
            <Card variant="none" effect="glass" className="border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Select Investor Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedProfile ? (
                  <div className="space-y-3">
                    {/* Selected Profile Preview */}
                    <div className="p-3 rounded-lg bg-linear-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <h4 className="font-bold">{selectedProfile.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {selectedProfile.title} • {selectedProfile.firm}
                          </p>
                        </div>
                      </div>

                      {/* Key Metrics Row */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {selectedProfile.aum_billions && (
                          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                            ${selectedProfile.aum_billions}B AUM
                          </span>
                        )}
                        {selectedProfile.risk_tolerance && (
                          <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            {selectedProfile.risk_tolerance}
                          </span>
                        )}
                        {selectedProfile.investment_style
                          ?.slice(0, 2)
                          .map((style) => (
                            <span
                              key={style}
                              className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400"
                            >
                              {style}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="none"
                        effect="glass"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedProfile(null)}
                        disabled={confirming}
                      >
                        Back
                      </Button>
                      <Button
                        variant="gradient"
                        effect="glass"
                        size="sm"
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
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search Warren Buffett..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="h-9 text-sm"
                      />
                      <Button
                        variant="gradient"
                        effect="glass"
                        size="sm"
                        onClick={handleSearch}
                        disabled={searching}
                      >
                        {searching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Results List */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.map((match) => (
                        <button
                          key={match.id}
                          onClick={() => handleSelectProfile(match)}
                          disabled={loadingProfile}
                          className="w-full p-2 rounded-lg glass-interactive flex items-center gap-2 text-left text-sm hover:bg-primary/5"
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {match.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {match.firm}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Cancel */}
                    <Button
                      variant="none"
                      effect="glass"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowProfileSearch(false);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Back to Analysis */}
          <Link href="/dashboard/kai/analysis">
            <Button variant="none" effect="glass" size="sm" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analysis
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
