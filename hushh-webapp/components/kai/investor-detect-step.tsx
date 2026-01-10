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
      }
    } catch (error) {
      console.error("[InvestorDetect] Load profile error:", error);
      toast.error("Failed to load investor profile");
    } finally {
      setLoading(false);
    }
  };

  // Confirm and encrypt profile to vault
  const handleConfirm = async () => {
    if (!selectedInvestor || !vaultKey || !vaultOwnerToken) {
      toast.error("Missing required data");
      return;
    }

    setConfirming(true);
    try {
      // Encrypt the profile data using vault key
      const profileJson = JSON.stringify({
        id: selectedInvestor.id,
        name: selectedInvestor.name,
        firm: selectedInvestor.firm,
        title: selectedInvestor.title,
        aum_billions: selectedInvestor.aum_billions,
        investment_style: selectedInvestor.investment_style,
        risk_tolerance: selectedInvestor.risk_tolerance,
        time_horizon: selectedInvestor.time_horizon,
        top_holdings: selectedInvestor.top_holdings,
        sector_exposure: selectedInvestor.sector_exposure,
        public_quotes: selectedInvestor.public_quotes,
        biography: selectedInvestor.biography,
      });

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
        toast.success(`Identity confirmed as ${selectedInvestor.name}`);
        onConfirm(selectedInvestor);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("[InvestorDetect] Confirm error:", error);
      toast.error("Failed to confirm identity");
    } finally {
      setConfirming(false);
    }
  };

  // Loading state
  if (loading && !selectedInvestor) {
    return (
      <Card className="glass-interactive border-0 shadow-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className="text-muted-foreground">Detecting investor profile...</p>
        </CardContent>
      </Card>
    );
  }

  // Profile preview state
  if (selectedInvestor) {
    return (
      <Card className="glass-interactive border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Confirm Your Profile</CardTitle>
          <CardDescription>
            This public information will be encrypted and stored in your vault
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Profile Card */}
          <div className="p-4 rounded-xl bg-linear-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{selectedInvestor.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedInvestor.title} @ {selectedInvestor.firm}
                </p>
                {selectedInvestor.aum_billions && (
                  <p className="text-xs text-muted-foreground mt-1">
                    AUM: ${selectedInvestor.aum_billions}B
                  </p>
                )}
              </div>
            </div>

            {/* Investment Style */}
            {selectedInvestor.investment_style && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  INVESTMENT STYLE
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedInvestor.investment_style.map((style) => (
                    <span
                      key={style}
                      className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Holdings */}
            {selectedInvestor.top_holdings &&
              selectedInvestor.top_holdings.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    TOP HOLDINGS
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvestor.top_holdings
                      .slice(0, 5)
                      .map((holding: any) => (
                        <span
                          key={holding.ticker}
                          className="px-2 py-1 text-xs rounded-full bg-zinc-500/20"
                        >
                          {holding.ticker}
                        </span>
                      ))}
                  </div>
                </div>
              )}
          </div>

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
            Not Me
          </Button>
          <Button
            variant="gradient"
            effect="glass"
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {confirming ? "Encrypting..." : "Confirm & Encrypt"}
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
                  <Loader2 className="w-4 h-4 animate-spin" />
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
