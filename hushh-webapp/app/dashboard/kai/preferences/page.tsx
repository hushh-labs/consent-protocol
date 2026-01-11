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
import { ArrowLeft, Check, Loader2, Search, Shield, Trash2 } from "lucide-react";

import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhVault } from "@/lib/capacitor";

import {
  IdentityService,
  InvestorMatch,
  InvestorProfile,
} from "@/lib/services/identity-service";
import {
  getEncryptedProfile,
  getPreferences,
  resetPreferences,
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
  const [selectedProfile, setSelectedProfile] = useState<InvestorProfile | null>(
    null
  );
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resettingIdentity, setResettingIdentity] = useState(false);
  const [resettingKai, setResettingKai] = useState(false);

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
      const nextPrefs: DecryptedKaiPrefs = { riskProfile: null, processingMode: null };
      for (const pref of preferences || []) {
        const plaintext = await decryptPayload(pref);
        if (pref.field_name === "kai_risk_profile") nextPrefs.riskProfile = plaintext;
        if (pref.field_name === "kai_processing_mode") nextPrefs.processingMode = plaintext;
      }
      setKaiPrefs(nextPrefs);

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

  const handleSelectProfile = useCallback(async (match: InvestorMatch) => {
    setLoadingProfile(true);
    try {
      const full = await IdentityService.getInvestorProfile(match.id);
      if (!full) throw new Error("Profile not found");
      setSelectedProfile(full);
    } catch (e) {
      console.error("[KaiPreferences] Load profile error:", e);
      toast.error("Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const handleConfirmProfile = useCallback(async () => {
    if (!selectedProfile || !vaultKey || !vaultOwnerToken) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: JSON.stringify(selectedProfile),
      });

      const result = await IdentityService.confirmIdentity(
        selectedProfile.id,
        { ciphertext: encrypted.ciphertext, iv: encrypted.iv, tag: encrypted.tag },
        vaultOwnerToken
      );

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Investor profile linked");
      setProfile(selectedProfile);
      setProfileNotFound(false);
      setSelectedProfile(null);
      setShowProfileSearch(false);
      setSearchResults([]);
      setSearchQuery("");
    } catch (e) {
      console.error("[KaiPreferences] Confirm error:", e);
      toast.error("Failed to confirm profile");
    } finally {
      setConfirming(false);
    }
  }, [selectedProfile, vaultKey, vaultOwnerToken]);

  const handleResetIdentity = useCallback(async () => {
    if (!vaultOwnerToken) return;
    setResettingIdentity(true);
    try {
      const result = await IdentityService.resetIdentity(vaultOwnerToken);
      if (!result.success) throw new Error("Reset failed");
      setProfile(null);
      setProfileNotFound(true);
      toast.success("Identity reset");
    } catch (e) {
      console.error("[KaiPreferences] Reset identity error:", e);
      toast.error("Failed to reset identity");
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

  if (!canLoad) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card variant="none" effect="glass" className="border-0">
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

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="none"
          effect="glass"
          size="icon-sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Kai Preferences</h1>
      </div>

      {loading ? (
        <HushhLoader label="Loading preferences..." />
      ) : (
        <>
          <Card variant="none" effect="glass" className="border-0 overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Investor identity (decrypted)
                  </div>
                  {profile ? (
                    <>
                      <div className="text-base font-semibold">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {profile.firm || "—"}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {profileNotFound
                        ? "No investor profile linked yet."
                        : "Unable to load investor profile."}
                    </div>
                  )}
                </div>

                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  onClick={handleResetIdentity}
                  disabled={!profile || resettingIdentity}
                  className="text-red-500"
                >
                  {resettingIdentity ? (
                    <HushhLoader variant="compact" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {!profile && autoDetectMatches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Suggested matches
                  </div>
                  <div className="space-y-1">
                    {autoDetectMatches.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectProfile(m)}
                        disabled={loadingProfile}
                        className="w-full p-2 rounded-lg glass-interactive text-left text-sm hover:bg-primary/5"
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

              <Button
                variant="none"
                effect="glass"
                size="sm"
                className="w-full"
                onClick={() => setShowProfileSearch(true)}
              >
                {profile ? "Change investor profile" : "Search investor profiles"}
              </Button>
            </CardContent>
          </Card>

          <Card variant="none" effect="glass" className="border-0 overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Kai preferences (decrypted)
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Risk: </span>
                    <span className="font-medium">
                      {kaiPrefs.riskProfile || "—"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Mode: </span>
                    <span className="font-medium">
                      {kaiPrefs.processingMode || "—"}
                    </span>
                  </div>
                </div>

                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  onClick={handleResetKaiPrefs}
                  disabled={resettingKai}
                  className="text-red-500"
                >
                  {resettingKai ? (
                    <HushhLoader variant="compact" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {showProfileSearch && (
            <Card variant="none" effect="glass" className="border-0">
              <CardContent className="p-4 space-y-3">
                {selectedProfile ? (
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-semibold">{selectedProfile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedProfile.firm || "—"}
                      </div>
                    </div>

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
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search investor (e.g. Warren Buffett)"
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

                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {searchResults.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectProfile(m)}
                          disabled={loadingProfile}
                          className="w-full p-2 rounded-lg glass-interactive text-left text-sm hover:bg-primary/5"
                        >
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.firm || "—"}
                          </div>
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="none"
                      effect="glass"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowProfileSearch(false);
                        setSelectedProfile(null);
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

