"use client";

/**
 * Investor Detect Step Component
 *
 * First step in Kai onboarding - detects investor from Firebase displayName
 * and allows confirmation or manual search.
 * Uses morphy-ux components per frontend-design-system.md.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  User,
  Building2,
  TrendingUp,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { HushhLoader } from "@/components/ui/hushh-loader";
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
import {
  IdentityService,
  InvestorMatch,
  InvestorProfile,
} from "@/lib/services/identity-service";
import { HushhVault } from "@/lib/capacitor";
import { toast } from "sonner";
import {
  InvestorProfileEditor,
  type EnrichedInvestorProfile,
} from "@/components/kai/investor-profile-editor";

interface InvestorDetectStepProps {
  onConfirm: (investor: InvestorProfile) => void;
  onSkip: () => void;
  vaultKey: string;
  vaultOwnerToken: string;
}

export function InvestorDetectStep({
  onConfirm,
  onSkip,
  vaultKey,
  vaultOwnerToken,
}: InvestorDetectStepProps) {
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvestorMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [detectedMatches, setDetectedMatches] = useState<InvestorMatch[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [selectedInvestor, setSelectedInvestor] =
    useState<InvestorProfile | null>(null);
  const [editableProfile, setEditableProfile] =
    useState<EnrichedInvestorProfile | null>(null);
  const [selectionSource, setSelectionSource] = useState<
    "auto_detect" | "search" | null
  >(null);
  const [showSearch, setShowSearch] = useState(false);

  // Auto-detect on mount
  useEffect(() => {
    async function autoDetect() {
      try {
        const result = await IdentityService.autoDetect();
        setDisplayName(result.display_name);

        if (result.detected && result.matches.length > 0) {
          setDetectedMatches(result.matches);
        }
      } catch (error) {
        console.error("[InvestorDetect] Auto-detect error:", error);
      } finally {
        setLoading(false);
      }
    }

    autoDetect();
  }, []);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) return;

    setSearching(true);
    try {
      const results = await IdentityService.searchInvestors(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("[InvestorDetect] Search error:", error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Select investor and load full profile
  const handleSelectInvestor = async (match: InvestorMatch) => {
    setLoading(true);
    try {
      const profile = await IdentityService.getInvestorProfile(match.id);
      if (profile) {
        setSelectedInvestor(profile);
        const isAuto = detectedMatches.some((m) => m.id === match.id);
        setSelectionSource(isAuto ? "auto_detect" : "search");
        setEditableProfile({
          ...profile,
          profile_version: 2,
          source: isAuto ? "auto_detect" : "search",
          last_edited_at: new Date().toISOString(),
          confirmed_investor_id: profile.id,
        });
      }
    } catch (error: any) {
      console.error("[InvestorDetect] Load profile error:", error);
      const errorMessage = error?.message || "Failed to load investor profile";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Confirm and encrypt profile to vault
  const handleConfirm = async () => {
    if (
      !selectedInvestor ||
      !editableProfile ||
      !vaultKey ||
      !vaultOwnerToken
    ) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      // Encrypt the FULL (possibly edited) profile data using vault key.
      // Backward compatible: older stored blobs may be partial; new writes are v2.
      const finalProfile: EnrichedInvestorProfile = {
        ...editableProfile,
        profile_version: 2,
        source: selectionSource || editableProfile.source || "search",
        last_edited_at: new Date().toISOString(),
        confirmed_investor_id: selectedInvestor.id,
      };

      const profileJson = JSON.stringify(finalProfile);

      const encrypted = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: profileJson,
      });

      // Send to backend
      const result = await IdentityService.confirmIdentity(
        selectedInvestor.id,
        {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
        },
        vaultOwnerToken
      );

      if (result.success) {
        toast.success(`Identity confirmed as ${finalProfile.name}`);
        onConfirm(finalProfile);
      } else {
        toast.error(result.message || "Failed to confirm identity");
      }
    } catch (error: any) {
      console.error("[InvestorDetect] Confirm error:", error);
      const errorMessage = error?.message || "Failed to confirm identity";
      toast.error(errorMessage);
    } finally {
      setConfirming(false);
    }
  };

  // Loading state
  if (loading && !selectedInvestor) {
    return (
      <Card className="glass-interactive border-0 shadow-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <HushhLoader
            label="Detecting investor profile..."
            variant="page"
            className="min-h-0"
          />
        </CardContent>
      </Card>
    );
  }

  // Profile preview state
  if (selectedInvestor) {
    return (
      <Card className="glass-interactive border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            Set up your Investor Mindset
          </CardTitle>
          <CardDescription>
            Kai tailors analysis using these signals. Edit anything — it’s
            encrypted with your vault key.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Full, editable metrics */}
          {editableProfile && (
            <InvestorProfileEditor
              value={editableProfile}
              onChange={setEditableProfile}
            />
          )}

          {/* Privacy Notice */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
            <p>
              <strong>Note:</strong> This public data will be encrypted with
              your personal vault key. The server cannot read it after
              encryption.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="none"
            effect="glass"
            className="flex-1"
            onClick={() => setSelectedInvestor(null)}
            disabled={confirming}
          >
            <X className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            variant="gradient"
            effect="glass"
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <HushhLoader variant="compact" className="mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {confirming ? "Saving..." : "Save Mindset"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Detection results or search state
  return (
    <Card className="glass-interactive border-0 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">
          {detectedMatches.length > 0
            ? "Is this you?"
            : "Find Your Investor Profile"}
        </CardTitle>
        <CardDescription>
          {detectedMatches.length > 0
            ? `We found profiles matching "${displayName}"`
            : "Search to pre-load your investment preferences"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Auto-detected matches */}
        {detectedMatches.length > 0 && !showSearch && (
          <div className="space-y-3">
            {detectedMatches.slice(0, 3).map((match) => (
              <button
                key={match.id}
                onClick={() => handleSelectInvestor(match)}
                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{match.name}</h4>
                  <p className="text-sm text-muted-foreground">{match.firm}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(match.confidence * 100)}% match
                </div>
              </button>
            ))}

            <Button
              variant="none"
              effect="glass"
              className="w-full"
              onClick={() => setShowSearch(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Search for different profile
            </Button>
          </div>
        )}

        {/* Search section */}
        {(showSearch || detectedMatches.length === 0) && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? (
                  <HushhLoader variant="compact" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Search results */}
            {searchResults.map((match) => (
              <button
                key={match.id}
                onClick={() => handleSelectInvestor(match)}
                className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 transition-all flex items-center gap-3 text-left"
              >
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{match.name}</h4>
                  <p className="text-xs text-muted-foreground">{match.firm}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="none"
          effect="glass"
          className="w-full"
          onClick={onSkip}
        >
          Skip - I'll set preferences manually
        </Button>
      </CardFooter>
    </Card>
  );
}
