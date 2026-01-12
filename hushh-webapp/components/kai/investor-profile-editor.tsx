"use client";

/**
 * InvestorProfileEditor (Investor Mindset)
 *
 * Design-system compliant (docs/technical/frontend-design-system.md):
 * - Morphy glass surfaces + Material ripple via Morphy components
 * - No hover scale
 * - Structured editing by default; Advanced JSON is optional
 *
 * Data:
 * - Works with partial (v1) encrypted blobs; user can save and upgrade to v2.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, X } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Button } from "@/lib/morphy-ux/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/morphy-ux/ui/tabs";

import type { InvestorProfile } from "@/lib/services/identity-service";

export type EnrichedInvestorProfile = InvestorProfile & {
  profile_version?: number;
  source?: "auto_detect" | "search";
  last_edited_at?: string;
  confirmed_investor_id?: number;

  data_sources?: string[] | null;
  last_13f_date?: string | null;
  last_form4_date?: string | null;
};

type HoldingRow = {
  ticker: string;
  weight?: number | null; // %
};

type SectorRow = {
  sector: string;
  value?: number | null; // %
};

type Jsonish = Record<string, unknown> | unknown[] | null;

function clampNumber(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

function uniqAdd(list: string[] | null | undefined, value: string): string[] {
  const base = Array.isArray(list) ? list : [];
  const v = value.trim();
  if (!v) return base;
  if (base.some((x) => x.toLowerCase() === v.toLowerCase())) return base;
  return [...base, v];
}

function stringifyJson(value: Jsonish): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function parseJsonOrToast<T extends Jsonish>(label: string, raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    toast.error(`${label}: invalid JSON`);
    return null;
  }
}

function listToCsv(list: string[] | null | undefined): string {
  return list?.length ? list.join(", ") : "";
}

function csvToList(raw: string): string[] | null {
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function asHoldingsRows(raw: unknown): HoldingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h: any) => {
      if (!h || typeof h !== "object") return null;
      const ticker = String(h.ticker ?? h.symbol ?? "").trim();
      if (!ticker) return null;
      const weight = typeof h.weight === "number" ? h.weight : null;
      return { ticker, weight } as HoldingRow;
    })
    .filter(Boolean) as HoldingRow[];
}

function rowsToHoldings(rows: HoldingRow[]): any[] | null {
  const out = rows
    .map((r) => {
      const ticker = r.ticker.trim().toUpperCase();
      if (!ticker) return null;
      const o: any = { ticker };
      if (typeof r.weight === "number" && Number.isFinite(r.weight)) o.weight = r.weight;
      return o;
    })
    .filter(Boolean) as any[];
  return out.length ? out : null;
}

function asSectorRows(raw: unknown): SectorRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  return Object.entries(obj)
    .map(([sector, v]) => ({
      sector,
      value: typeof v === "number" ? v : null,
    }))
    .filter((r) => r.sector.trim().length > 0);
}

function rowsToSectorExposure(rows: SectorRow[]): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.sector.trim();
    if (!key) continue;
    if (typeof r.value === "number" && Number.isFinite(r.value)) out[key] = r.value;
  }
  return Object.keys(out).length ? out : null;
}

export function InvestorProfileEditor(props: {
  value: EnrichedInvestorProfile;
  onChange: (next: EnrichedInvestorProfile) => void;
  readOnlyProvenance?: boolean;
}) {
  const { value, onChange, readOnlyProvenance = true } = props;

  const [styleInput, setStyleInput] = useState("");
  const [buysInput, setBuysInput] = useState("");
  const [sellsInput, setSellsInput] = useState("");

  const [holdingsRows, setHoldingsRows] = useState<HoldingRow[]>(() =>
    asHoldingsRows((value.top_holdings as any) ?? null)
  );
  const [sectorRows, setSectorRows] = useState<SectorRow[]>(() =>
    asSectorRows((value.sector_exposure as any) ?? null)
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [topHoldingsJson, setTopHoldingsJson] = useState(
    stringifyJson((value.top_holdings as any) ?? null)
  );
  const [sectorExposureJson, setSectorExposureJson] = useState(
    stringifyJson((value.sector_exposure as any) ?? null)
  );
  const [publicQuotesJson, setPublicQuotesJson] = useState(
    stringifyJson((value.public_quotes as any) ?? null)
  );

  const safeAum = useMemo(
    () => (value.aum_billions == null ? "" : String(value.aum_billions)),
    [value.aum_billions]
  );

  const holdingsChartData = useMemo(() => {
    return holdingsRows
      .map((r) => ({
        ticker: r.ticker.trim().toUpperCase(),
        value: typeof r.weight === "number" ? r.weight : 0,
      }))
      .filter((r) => r.ticker && Number.isFinite(r.value) && r.value > 0)
      .slice(0, 12);
  }, [holdingsRows]);

  const sectorChartData = useMemo(() => {
    return sectorRows
      .map((r) => ({
        name: r.sector.trim(),
        value: typeof r.value === "number" ? r.value : 0,
      }))
      .filter((r) => r.name && Number.isFinite(r.value) && r.value > 0)
      .slice(0, 12);
  }, [sectorRows]);

  const applyStructured = () => {
    onChange({
      ...value,
      top_holdings: rowsToHoldings(holdingsRows) as any,
      sector_exposure: rowsToSectorExposure(sectorRows) as any,
    });
  };

  const applyAdvancedJson = () => {
    const top = parseJsonOrToast<unknown[]>("Top holdings", topHoldingsJson);
    const sector = parseJsonOrToast<Record<string, unknown>>(
      "Sector exposure",
      sectorExposureJson
    );
    const quotes = parseJsonOrToast<unknown[]>("Public quotes", publicQuotesJson);

    setHoldingsRows(asHoldingsRows(top));
    setSectorRows(asSectorRows(sector));

    onChange({
      ...value,
      top_holdings: top as any,
      sector_exposure: sector as any,
      public_quotes: quotes as any,
    });
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="mindset" className="w-full">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="mindset">Mindset</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio DNA</TabsTrigger>
          <TabsTrigger value="background">Background</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="mindset" className="space-y-3">
          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                How Kai will tailor analysis
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground">
                    Risk tolerance
                  </div>
                  <Input
                    value={value.risk_tolerance || ""}
                    onChange={(e) =>
                      onChange({ ...value, risk_tolerance: e.target.value })
                    }
                    placeholder="balanced"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground">
                    Time horizon
                  </div>
                  <Input
                    value={value.time_horizon || ""}
                    onChange={(e) =>
                      onChange({ ...value, time_horizon: e.target.value })
                    }
                    placeholder="long"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground">
                    Portfolio turnover
                  </div>
                  <Input
                    value={value.portfolio_turnover || ""}
                    onChange={(e) =>
                      onChange({ ...value, portfolio_turnover: e.target.value })
                    }
                    placeholder="low"
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground">AUM (B)</div>
                  <Input
                    value={safeAum}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      const num = v ? Number(v) : null;
                      onChange({
                        ...value,
                        aum_billions: Number.isFinite(num as number) ? num : null,
                      });
                    }}
                    placeholder="—"
                    className="h-9 text-sm mt-1"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground">
                  Investment style
                </div>
                <div className="flex flex-wrap gap-2">
                  {(value.investment_style || []).map((s, idx) => (
                    <Badge key={`${s}-${idx}`} variant="secondary" className="gap-1">
                      {s}
                      <button
                        type="button"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                        onClick={() =>
                          onChange({
                            ...value,
                            investment_style: removeAt(value.investment_style || [], idx),
                          })
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={styleInput}
                    onChange={(e) => setStyleInput(e.target.value)}
                    placeholder="Add a style (e.g., value, growth)"
                    className="h-9 text-sm"
                  />
                  <Button
                    variant="none"
                    effect="glass"
                    size="icon-sm"
                    showRipple
                    onClick={() => {
                      onChange({
                        ...value,
                        investment_style: uniqAdd(value.investment_style, styleInput),
                      });
                      setStyleInput("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
          </div>
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-3">
          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Top holdings</div>
                <Button
                  variant="none"
                  effect="glass"
                  size="sm"
                  showRipple
                  onClick={() =>
                    setHoldingsRows([...holdingsRows, { ticker: "", weight: null }])
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {holdingsRows.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Add a few holdings so Kai can avoid redundant bets and flag
                    concentration risk.
                  </div>
                )}
                {holdingsRows.map((r, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_110px_40px] gap-2 items-center"
                  >
                    <Input
                      value={r.ticker}
                      onChange={(e) => {
                        const next = [...holdingsRows];
                        next[idx] = { ticker: e.target.value, weight: r.weight ?? null };
                        setHoldingsRows(next);
                      }}
                      placeholder="Ticker (e.g., AAPL)"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={typeof r.weight === "number" ? String(r.weight) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const num = raw ? Number(raw) : null;
                        const next = [...holdingsRows];
                        next[idx] = {
                          ticker: r.ticker,
                          weight:
                            typeof num === "number" && Number.isFinite(num)
                              ? clampNumber(num, 0, 100)
                              : null,
                        };
                        setHoldingsRows(next);
                      }}
                      placeholder="%"
                      className="h-9 text-sm"
                      inputMode="decimal"
                    />
                    <Button
                      variant="none"
                      effect="glass"
                      size="icon-sm"
                      showRipple
                      onClick={() => setHoldingsRows(removeAt(holdingsRows, idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="gradient"
                  effect="glass"
                  size="sm"
                  showRipple
                  onClick={applyStructured}
                >
                  Apply
                </Button>
                <div className="text-xs text-muted-foreground self-center">
                  Weight is optional; tickers still personalize analysis.
                </div>
              </div>

              {holdingsChartData.length > 0 && (
                <div className="h-44 rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">
                    Holdings snapshot
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={holdingsChartData}>
                      <XAxis
                        dataKey="ticker"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(0,0,0,0.8)",
                          border: "none",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[6, 6, 6, 6]}
                        fill="hsl(var(--primary))"
                        opacity={0.7}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
          </div>

          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Sector exposure</div>
                <Button
                  variant="none"
                  effect="glass"
                  size="sm"
                  showRipple
                  onClick={() => setSectorRows([...sectorRows, { sector: "", value: null }])}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {sectorRows.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Add sector weights (%) to help Kai flag concentration and cyclicality
                    risk.
                  </div>
                )}
                {sectorRows.map((r, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_110px_40px] gap-2 items-center"
                  >
                    <Input
                      value={r.sector}
                      onChange={(e) => {
                        const next = [...sectorRows];
                        next[idx] = { sector: e.target.value, value: r.value ?? null };
                        setSectorRows(next);
                      }}
                      placeholder="Sector (e.g., technology)"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={typeof r.value === "number" ? String(r.value) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const num = raw ? Number(raw) : null;
                        const next = [...sectorRows];
                        next[idx] = {
                          sector: r.sector,
                          value:
                            typeof num === "number" && Number.isFinite(num)
                              ? clampNumber(num, 0, 100)
                              : null,
                        };
                        setSectorRows(next);
                      }}
                      placeholder="%"
                      className="h-9 text-sm"
                      inputMode="decimal"
                    />
                    <Button
                      variant="none"
                      effect="glass"
                      size="icon-sm"
                      showRipple
                      onClick={() => setSectorRows(removeAt(sectorRows, idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="gradient"
                  effect="glass"
                  size="sm"
                  showRipple
                  onClick={applyStructured}
                >
                  Apply
                </Button>
                <div className="text-xs text-muted-foreground self-center">
                  (Optional) values should be percentages.
                </div>
              </div>

              {sectorChartData.length > 0 && (
                <div className="h-52 rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="text-[10px] text-muted-foreground mb-1">
                    Sector donut
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(0,0,0,0.8)",
                          border: "none",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                      <Pie
                        data={sectorChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={42}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {sectorChartData.map((_, i) => (
                          <Cell
                            key={i}
                            fill="hsl(var(--primary))"
                            fillOpacity={0.25 + (i % 6) * 0.1}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
          </div>

          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="text-xs text-muted-foreground">Recent activity</div>

              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground">Recent buys</div>
                <div className="flex flex-wrap gap-2">
                  {(value.recent_buys || []).map((t, idx) => (
                    <Badge key={`${t}-${idx}`} variant="outline" className="gap-1">
                      {t}
                      <button
                        type="button"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                        onClick={() =>
                          onChange({
                            ...value,
                            recent_buys: removeAt(value.recent_buys || [], idx),
                          })
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={buysInput}
                    onChange={(e) => setBuysInput(e.target.value)}
                    placeholder="Add buy ticker"
                    className="h-9 text-sm"
                  />
                  <Button
                    variant="none"
                    effect="glass"
                    size="icon-sm"
                    showRipple
                    onClick={() => {
                      onChange({
                        ...value,
                        recent_buys: uniqAdd(value.recent_buys, buysInput.toUpperCase()),
                      });
                      setBuysInput("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground">Recent sells</div>
                <div className="flex flex-wrap gap-2">
                  {(value.recent_sells || []).map((t, idx) => (
                    <Badge key={`${t}-${idx}`} variant="outline" className="gap-1">
                      {t}
                      <button
                        type="button"
                        className="opacity-80 hover:opacity-100 transition-opacity"
                        onClick={() =>
                          onChange({
                            ...value,
                            recent_sells: removeAt(value.recent_sells || [], idx),
                          })
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={sellsInput}
                    onChange={(e) => setSellsInput(e.target.value)}
                    placeholder="Add sell ticker"
                    className="h-9 text-sm"
                  />
                  <Button
                    variant="none"
                    effect="glass"
                    size="icon-sm"
                    showRipple
                    onClick={() => {
                      onChange({
                        ...value,
                        recent_sells: uniqAdd(value.recent_sells, sellsInput.toUpperCase()),
                      });
                      setSellsInput("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
          </div>
        </TabsContent>

        <TabsContent value="background" className="space-y-3">
          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                Background & credibility
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Input
                  value={value.name || ""}
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                  placeholder="Name"
                  className="h-9 text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={value.firm || ""}
                    onChange={(e) => onChange({ ...value, firm: e.target.value })}
                    placeholder="Firm"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={value.title || ""}
                    onChange={(e) => onChange({ ...value, title: e.target.value })}
                    placeholder="Title"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={value.investor_type || ""}
                    onChange={(e) =>
                      onChange({ ...value, investor_type: e.target.value })
                    }
                    placeholder="Investor type"
                    className="h-9 text-sm"
                  />
                  <Input
                    value={value.photo_url || ""}
                    onChange={(e) =>
                      onChange({ ...value, photo_url: e.target.value })
                    }
                    placeholder="Photo URL"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground">Biography</div>
                <textarea
                  value={value.biography || ""}
                  onChange={(e) =>
                    onChange({ ...value, biography: e.target.value })
                  }
                  className="w-full min-h-24 rounded-md border bg-background/60 p-2 text-xs"
                  placeholder="Short background / investing philosophy"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Insider</div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!value.is_insider}
                    onChange={(e) =>
                      onChange({ ...value, is_insider: e.target.checked })
                    }
                  />
                  <span className="text-sm">Is insider</span>
                </div>
                <Input
                  value={value.insider_company_ticker || ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      insider_company_ticker: e.target.value || null,
                    })
                  }
                  placeholder="Insider company ticker"
                  className="h-9 text-sm"
                />
              </div>

              <div className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-2">
                <div className="text-xs text-muted-foreground">Provenance</div>
                <Input
                  value={listToCsv((value.data_sources as any) || null)}
                  onChange={(e) => {
                    if (readOnlyProvenance) return;
                    onChange({ ...value, data_sources: csvToList(e.target.value) });
                  }}
                  placeholder="data_sources"
                  className="h-9 text-sm"
                  disabled={readOnlyProvenance}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={(value.last_13f_date as any) || ""}
                    onChange={(e) => {
                      if (readOnlyProvenance) return;
                      onChange({ ...value, last_13f_date: e.target.value || null });
                    }}
                    placeholder="last_13f_date"
                    className="h-9 text-sm"
                    disabled={readOnlyProvenance}
                  />
                  <Input
                    value={(value.last_form4_date as any) || ""}
                    onChange={(e) => {
                      if (readOnlyProvenance) return;
                      onChange({
                        ...value,
                        last_form4_date: e.target.value || null,
                      });
                    }}
                    placeholder="last_form4_date"
                    className="h-9 text-sm"
                    disabled={readOnlyProvenance}
                  />
                </div>
              </div>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-3">
          <div className="glass-interactive rounded-xl border border-border/50 p-4 space-y-3">
              <div className="text-xs text-muted-foreground">Advanced JSON</div>
              <div className="text-xs text-muted-foreground">
                Optional: paste JSON directly. The structured UI is the default.
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="none" effect="glass" size="sm" showRipple>
                    <ChevronDown
                      className={`w-4 h-4 mr-2 transition-transform ${
                        advancedOpen ? "rotate-180" : ""
                      }`}
                    />
                    Open JSON editor
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Top holdings (JSON array)
                    </div>
                    <textarea
                      value={topHoldingsJson}
                      onChange={(e) => setTopHoldingsJson(e.target.value)}
                      className="w-full min-h-28 rounded-md border bg-background/60 p-2 text-xs font-mono"
                      placeholder='[{"ticker":"AAPL","weight":12.5}]'
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Sector exposure (JSON object)
                    </div>
                    <textarea
                      value={sectorExposureJson}
                      onChange={(e) => setSectorExposureJson(e.target.value)}
                      className="w-full min-h-24 rounded-md border bg-background/60 p-2 text-xs font-mono"
                      placeholder='{"technology":40.5,"healthcare":25}'
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Public quotes (JSON array)
                    </div>
                    <textarea
                      value={publicQuotesJson}
                      onChange={(e) => setPublicQuotesJson(e.target.value)}
                      className="w-full min-h-24 rounded-md border bg-background/60 p-2 text-xs font-mono"
                      placeholder='[{"quote":"...","source":"...","year":2024}]'
                    />
                  </div>

                  <Button
                    variant="gradient"
                    effect="glass"
                    size="sm"
                    showRipple
                    onClick={applyAdvancedJson}
                  >
                    Apply advanced JSON
                  </Button>
                </CollapsibleContent>
              </Collapsible>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

