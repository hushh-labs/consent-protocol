"use client";

/**
 * Kai Preferences Page (Rebuilt)
 *
 * Shows what we capture today (and nothing else):
 * - Investor identity: encrypted copy in `user_investor_profiles` (client decrypts)
 * - Kai prefs: encrypted rows in `vault_kai_preferences` (client decrypts)
 *
 * Invariants:
 * - BYOK: vault key never leaves device
 * - Consent-first: identity confirm/reset and prefs reset require VAULT_OWNER
 * - Page does not call fetch(); it uses services/plugins only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Save,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhVault } from "@/lib/capacitor";

import {
  IdentityService,
  InvestorMatch,
  InvestorProfile,
} from "@/lib/services/identity-service";
import {
  InvestorProfileEditor,
  type EnrichedInvestorProfile,
} from "@/components/kai/investor-profile-editor";
import {
  getEncryptedProfile,
  getPreferences,
  resetPreferences,
  storePreferences,
} from "@/lib/services/kai-service";
import { HushhLoader } from "@/components/ui/hushh-loader";

type DecryptedKaiPrefs = {
  riskProfile: string | null;
  processingMode: string | null;
};

export default function KaiPreferencesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVaultUnlocked, vaultKey, vaultOwnerToken } = useVault();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Identity (decrypted)
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);

  // Kai prefs (decrypted)
  const [kaiPrefs, setKaiPrefs] = useState<DecryptedKaiPrefs>({
    riskProfile: null,
    processingMode: null,
  });

  // Auto-detect + search UI
  const [autoDetectMatches, setAutoDetectMatches] = useState<InvestorMatch[]>(
    []
  );
  const [showProfileSearch, setShowProfileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvestorMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<InvestorProfile | null>(null);
  const [editingProfile, setEditingProfile] =
    useState<EnrichedInvestorProfile | null>(null);
  const [isManualSetup, setIsManualSetup] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resettingIdentity, setResettingIdentity] = useState(false);
  const [resettingKai, setResettingKai] = useState(false);

  // Processing mode draft (risk comes from profile now)
  const [draftProcessingMode, setDraftProcessingMode] = useState<
    "on_device" | "hybrid" | ""
  >("");

  const canLoad = useMemo(() => {
    return !!user?.uid && !!vaultKey && !!vaultOwnerToken;
  }, [user?.uid, vaultKey, vaultOwnerToken]);

  const decryptPayload = useCallback(
    async (payload: { ciphertext: string; iv: string; tag?: string }) => {
      if (!vaultKey) throw new Error("Missing vault key");
      const res = await HushhVault.decryptData({
        keyHex: vaultKey,
        payload: {
          ciphertext: payload.ciphertext,
          iv: payload.iv,
          tag: payload.tag || "",
          encoding: "base64",
          algorithm: "aes-256-gcm",
        },
      });
      return res.plaintext;
    },
    [vaultKey]
  );

  const loadAll = useCallback(async () => {
    if (!user?.uid || !vaultOwnerToken) return;
    if (!vaultKey) return;

    setLoading(true);
    setProfileNotFound(false);
    try {
      // Identity (encrypted DB record -> decrypt client-side)
      try {
        const encrypted = await getEncryptedProfile(vaultOwnerToken);
        const plaintext = await decryptPayload(encrypted.profile_data);
        setProfile(JSON.parse(plaintext) as InvestorProfile);
      } catch (e: any) {
        const status = e?.status;
        if (status === 404) {
          setProfile(null);
          setProfileNotFound(true);
        } else {
          throw e;
        }
      }

      // Kai prefs (encrypted rows -> decrypt client-side)
      const { preferences } = await getPreferences(user.uid);
      const nextPrefs: DecryptedKaiPrefs = {
        riskProfile: null,
        processingMode: null,
      };
      for (const pref of preferences || []) {
        const plaintext = await decryptPayload(pref);
        if (pref.field_name === "kai_risk_profile")
          nextPrefs.riskProfile = plaintext;
        if (pref.field_name === "kai_processing_mode")
          nextPrefs.processingMode = plaintext;
      }
      setKaiPrefs(nextPrefs);
      // Processing mode only (risk comes from profile now)
      setDraftProcessingMode(
        (nextPrefs.processingMode as any) === "on_device" ||
          (nextPrefs.processingMode as any) === "hybrid"
          ? (nextPrefs.processingMode as any)
          : ""
      );

      // Auto-detect suggestions (low friction)
      const auto = await IdentityService.autoDetect();
      setAutoDetectMatches(auto.matches || []);
    } catch (err) {
      console.error("[KaiPreferences] Load error:", err);
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, [decryptPayload, user?.uid, vaultKey, vaultOwnerToken]);

  useEffect(() => {
    if (!canLoad) return;
    loadAll();
  }, [canLoad, loadAll]);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await IdentityService.searchInvestors(searchQuery.trim());
      setSearchResults(results);
    } catch (e) {
      console.error("[KaiPreferences] Search error:", e);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSelectProfile = useCallback(
    async (match: InvestorMatch) => {
      setLoadingProfile(true);
      try {
        const full = await IdentityService.getInvestorProfile(match.id);
        if (!full) throw new Error("Profile not found");
        setSelectedProfile(full);
        const isAuto = autoDetectMatches.some((m) => m.id === match.id);
        setEditingProfile({
          ...full,
          profile_version: 2,
          source: isAuto ? "auto_detect" : "search",
          last_edited_at: new Date().toISOString(),
          confirmed_investor_id: full.id,
        });
      } catch (e) {
        console.error("[KaiPreferences] Load profile error:", e);
        toast.error("Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    },
    [autoDetectMatches]
  );

  const handleManualSetup = useCallback(() => {
    setIsManualSetup(true);
    setEditingProfile({
      id: 0, // Placeholder
      name: "Manual Profile",
      firm: "Self-Managed",
      profile_version: 2,
      source: "manual",
      last_edited_at: new Date().toISOString(),
      confirmed_investor_id: 0,
      risk_tolerance: "Balanced",
      investment_style: [],
      top_holdings: [],
      sector_exposure: {},
    } as any);
    setIsEditing(true);
  }, []);

  const handleConfirmProfile = useCallback(async () => {
    if (!selectedProfile || !editingProfile || !vaultKey || !vaultOwnerToken) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: JSON.stringify({
          ...editingProfile,
          profile_version: 2,
          last_edited_at: new Date().toISOString(),
          confirmed_investor_id: selectedProfile.id,
        }),
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

      if (!result.success) {
        toast.error(result.message || "Failed to confirm profile");
        return;
      }

      toast.success("Investor profile linked");
      setProfile(editingProfile as InvestorProfile);
      setProfileNotFound(false);
      setSelectedProfile(null);
      setEditingProfile(null);
      setShowProfileSearch(false);
      setSearchResults([]);
      setSearchQuery("");
    } catch (e) {
      console.error("[KaiPreferences] Confirm error:", e);
      toast.error("Failed to confirm profile");
    } finally {
      setConfirming(false);
    }
  }, [selectedProfile, editingProfile, vaultKey, vaultOwnerToken]);

  const handleSaveAll = useCallback(async () => {
    if (!user?.uid || !vaultKey || !vaultOwnerToken) return;
    if (!editingProfile) {
      toast.error("No profile loaded to save");
      return;
    }
    const investorId =
      (selectedProfile as any)?.id ??
      (editingProfile as any).id ??
      editingProfile.confirmed_investor_id;

    // Allow saving Kai Prefs even if no investor ID (Manual Mode)
    const isManual = !investorId || investorId === 0;

    setSavingAll(true);
    try {
      // 1) Save processing mode only (risk comes from profile's risk_tolerance)
      if (draftProcessingMode) {
        const encMode = await HushhVault.encryptData({
          keyHex: vaultKey,
          plaintext: draftProcessingMode,
        });
        await storePreferences(user.uid, [
          {
            field_name: "kai_processing_mode",
            ciphertext: encMode.ciphertext,
            iv: encMode.iv,
            tag: encMode.tag,
          },
        ]);
        setKaiPrefs({
          riskProfile: null, // No longer stored separately
          processingMode: draftProcessingMode,
        });
      }

      // 2) Save investor profile metrics (encrypted blob) - ONLY if linked to VIP
      if (!isManual) {
        const encrypted = await HushhVault.encryptData({
          keyHex: vaultKey,
          plaintext: JSON.stringify({
            ...editingProfile,
            profile_version: 2,
            last_edited_at: new Date().toISOString(),
            confirmed_investor_id: investorId,
          }),
        });

        const result = await IdentityService.confirmIdentity(
          investorId,
          {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            tag: encrypted.tag,
          },
          vaultOwnerToken
        );

        if (!result.success) {
          toast.error(result.message || "Failed to save preferences");
          return;
        }
        setProfile(editingProfile as InvestorProfile);
      } else {
        // Manual mode: we don't save the blob to DB, but we keep it in local state
        // or we could warn the user. For now, let's just toast.
        toast.info(
          "Runtime preferences saved. Link a VIP to save portfolio DNA."
        );
      }

      toast.success("Preferences saved");
      setIsEditing(false);
      setIsManualSetup(false);
    } catch (e: any) {
      console.error("[KaiPreferences] Save error:", e);
      toast.error(e?.message || "Failed to save preferences");
    } finally {
      setSavingAll(false);
    }
  }, [
    user?.uid,
    vaultKey,
    vaultOwnerToken,
    editingProfile,
    selectedProfile,
    draftProcessingMode,
  ]);

  const handleResetIdentity = useCallback(async () => {
    if (!vaultOwnerToken) return;
    setResettingIdentity(true);
    try {
      const result = await IdentityService.resetIdentity(vaultOwnerToken);
      if (!result.success) throw new Error("Reset failed");
      setProfile(null);
      setProfileNotFound(true);
      toast.success("Identity reset");
    } catch (e: any) {
      console.error("[KaiPreferences] Reset identity error:", e);
      const errorMessage = e?.message || "Failed to reset identity";
      toast.error(errorMessage);
    } finally {
      setResettingIdentity(false);
    }
  }, [vaultOwnerToken]);

  const handleResetKaiPrefs = useCallback(async () => {
    if (!user?.uid || !vaultOwnerToken) return;
    setResettingKai(true);
    try {
      await resetPreferences(user.uid, vaultOwnerToken);
      setKaiPrefs({ riskProfile: null, processingMode: null });
      toast.success("Kai preferences reset");
    } catch (e) {
      console.error("[KaiPreferences] Reset Kai prefs error:", e);
      toast.error("Failed to reset Kai preferences");
    } finally {
      setResettingKai(false);
    }
  }, [user?.uid, vaultOwnerToken]);

  if (!isVaultUnlocked) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card
          variant="none"
          effect="glass"
          showRipple={false}
          className="border-0"
        >
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

  if (!canLoad) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card
          variant="none"
          effect="glass"
          showRipple={false}
          className="border-0"
        >
          <CardContent className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Vault is unlocked, but key/token is not available in this tab.
            </p>
            <p className="text-xs text-muted-foreground">
              Re-unlock the vault to load encrypted preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derived visual state (Live Preview during edit)
  const displayProfile = useMemo(() => {
    return isEditing && editingProfile ? editingProfile : profile;
  }, [isEditing, editingProfile, profile]);

  const displayKaiPrefs = useMemo(() => {
    // Risk now comes from profile, only processing mode is tracked separately
    return {
      riskProfile: null, // Deprecated - use displayProfile.risk_tolerance
      processingMode: draftProcessingMode || kaiPrefs.processingMode,
    };
  }, [draftProcessingMode, kaiPrefs.processingMode]);

  const holdingsChartData = useMemo(() => {
    const list = (displayProfile as any)?.top_holdings || [];
    if (!Array.isArray(list)) return [];
    return list
      .map((h: any) => ({
        ticker: String(h?.ticker ?? h?.symbol ?? "").toUpperCase(),
        value: typeof h?.weight === "number" ? h.weight : 0,
      }))
      .filter((r: any) => r.ticker && Number.isFinite(r.value) && r.value > 0)
      .slice(0, 10);
  }, [displayProfile]);

  const sectorChartData = useMemo(() => {
    const obj = (displayProfile as any)?.sector_exposure;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
    return Object.entries(obj as Record<string, any>)
      .map(([name, v]) => ({ name, value: typeof v === "number" ? v : 0 }))
      .filter((r) => r.name && Number.isFinite(r.value) && r.value > 0)
      .slice(0, 10);
  }, [displayProfile]);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Preferences</h1>

        <div className="ml-auto flex items-center gap-2">
          {(profile || isManualSetup) && (
            <Button
              variant={isEditing ? "none" : "gradient"}
              effect="glass"
              size="sm"
              showRipple
              onClick={() => {
                if (isManualSetup) {
                  setIsManualSetup(false);
                  setEditingProfile(null);
                  setIsEditing(false);
                  return;
                }
                if (!profile) return;
                if (!isEditing) {
                  // Enter Edit Mode
                  setEditingProfile({
                    ...(profile as any),
                    profile_version: (profile as any).profile_version || 2,
                    source: (profile as any).source || "search",
                    last_edited_at: new Date().toISOString(),
                    confirmed_investor_id: (profile as any).id,
                  });
                  setIsEditing(true);
                } else {
                  // Cancel Edit Mode
                  setIsEditing(false);
                  setEditingProfile(null);
                }
              }}
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
          )}
          {isEditing && (
            <Button
              variant="gradient"
              effect="glass"
              size="sm"
              showRipple
              onClick={handleSaveAll}
              disabled={savingAll}
            >
              {savingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <HushhLoader label="Loading preferences..." />
      ) : (
        <>
          <Card
            variant="none"
            effect="glass"
            className="border-0 overflow-hidden"
          >
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    VIP profile (baseline)
                  </div>
                  {displayProfile ? (
                    <>
                      <div className="text-base font-semibold">
                        {displayProfile.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(displayProfile as any).title
                          ? `${(displayProfile as any).title} • `
                          : ""}
                        {displayProfile.firm || "—"}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {profileNotFound
                        ? "No VIP profile set yet."
                        : "Unable to load profile."}
                    </div>
                  )}
                </div>

                {isEditing && profile && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="none"
                          effect="glass"
                          size="icon-sm"
                          onClick={() => {
                            handleResetIdentity();
                            setIsManualSetup(false);
                            setEditingProfile(null);
                            setIsEditing(false);
                          }}
                          disabled={resettingIdentity}
                          className="text-red-500"
                          showRipple
                        >
                          {resettingIdentity ? (
                            <HushhLoader variant="compact" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Unlink this investor profile. Your Kai risk
                          preferences remain saved.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {isEditing && (
                <Button
                  variant="none"
                  effect="glass"
                  size="sm"
                  showRipple
                  onClick={() => setShowProfileSearch(true)}
                  className="w-full"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {profile ? "Change VIP Profile" : "Select VIP Profile"}
                </Button>
              )}

              {showProfileSearch && isEditing && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Choose a public baseline profile
                    </div>
                    <Button
                      variant="none"
                      effect="glass"
                      size="icon-sm"
                      showRipple
                      onClick={() => {
                        setShowProfileSearch(false);
                        setSelectedProfile(null);
                        setEditingProfile(null);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {autoDetectMatches.length > 0 &&
                    !selectedProfile &&
                    !editingProfile && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Suggested matches
                        </div>
                        <div className="space-y-1">
                          {autoDetectMatches.slice(0, 4).map((m) => (
                            <button
                              key={m.id}
                              onClick={() => handleSelectProfile(m)}
                              disabled={loadingProfile}
                              className="w-full p-3 rounded-xl border border-border/50 bg-background/40 text-left text-sm hover:border-primary/50 transition-colors"
                            >
                              <div className="font-medium">{m.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {m.firm || "—"}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedProfile && editingProfile ? (
                    <div className="space-y-3">
                      <Card
                        variant="none"
                        effect="glass"
                        showRipple={false}
                        className="border-0"
                      >
                        <CardContent className="p-3 text-xs text-muted-foreground">
                          This will copy the public VIP profile into your
                          encrypted vault. You can edit any fields before
                          confirming.
                        </CardContent>
                      </Card>
                      <InvestorProfileEditor
                        value={editingProfile}
                        onChange={setEditingProfile}
                        flat
                      />

                      <div className="flex gap-2">
                        <Button
                          variant="none"
                          effect="glass"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedProfile(null);
                            setEditingProfile(null);
                          }}
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
                      <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md bg-background/40">
                        <div className="flex items-center gap-3 flex-1 px-4">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search investor (e.g. Warren Buffett)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleSearch()
                            }
                            className="bg-transparent border-0 outline-none text-base font-black placeholder:text-muted-foreground/50 w-full"
                          />
                        </div>
                        <Button
                          variant="gradient"
                          effect="glass"
                          size="sm"
                          onClick={handleSearch}
                          disabled={searching}
                          className="rounded-lg h-10 px-6 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg"
                        >
                          {searching ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "SEARCH"
                          )}
                        </Button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {searchResults.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => handleSelectProfile(m)}
                              disabled={loadingProfile}
                              className="w-full p-2 rounded-lg border border-border/50 bg-background/40 text-left text-sm hover:border-primary/50 transition-colors"
                            >
                              <div className="font-medium">{m.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {m.firm || "—"}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Tip: pick the closest match, then fine-tune in Edit
                        mode.
                      </div>
                    </>
                  )}
                </div>
              )}

              {!profile && !isEditing && !showProfileSearch && (
                <div className="mt-4">
                  <Button
                    variant="gradient"
                    effect="glass"
                    size="sm"
                    showRipple
                    onClick={handleManualSetup}
                    className="w-full"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Manual Setup
                  </Button>
                </div>
              )}

              {/* Preferences Editor (Always visible) */}
              {displayProfile && !showProfileSearch && (
                <div className="space-y-4 pt-4 animate-in fade-in duration-500">
                  {/* Kai Runtime Settings - Processing Mode Only (Risk comes from profile) */}
                  <Card variant="muted" effect="glass" showRipple={false}>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">
                        Kai runtime
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          risk:{displayProfile?.risk_tolerance || "balanced"}
                        </Badge>
                        <Badge variant="secondary">
                          mode:hybrid
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Risk is derived from your profile&apos;s risk tolerance setting in Prefs tab
                      </p>
                    </CardContent>
                  </Card>

                  {/* Main Profile Editor (Read-only or Editable) */}
                  <div className={isEditing ? "opacity-100" : "opacity-90"}>
                    <InvestorProfileEditor
                      value={displayProfile}
                      onChange={
                        isEditing ? setEditingProfile : (v) => undefined
                      }
                      flat
                      readOnly={!isEditing}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
