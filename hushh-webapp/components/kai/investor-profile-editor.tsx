"use client";

/**
 * InvestorProfileEditor (Investor Preference)
 *
 * Design-system compliant (docs/technical/frontend-design-system.md):
 * - Morphy glass surfaces + Material ripple via Morphy components
 * - No hover scale
 * - Structured editing by default
 *
 * Data:
 * - Works with partial (v1) encrypted blobs; user can save and upgrade to v2.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/lib/morphy-ux/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/lib/morphy-ux/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/lib/morphy-ux/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { InvestorProfile } from "@/lib/services/identity-service";
import { cn } from "@/lib/utils";

// Predefined investment styles for multi-select
const INVESTMENT_STYLES = [
  "Growth",
  "Value",
  "Income",
  "Momentum",
  "Quality",
  "GARP",
  "Deep Value",
  "Contrarian",
  "Index",
  "Quant",
] as const;

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
      if (typeof r.weight === "number" && Number.isFinite(r.weight))
        o.weight = r.weight;
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

function rowsToSectorExposure(
  rows: SectorRow[]
): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.sector.trim();
    if (!key) continue;
    if (typeof r.value === "number" && Number.isFinite(r.value))
      out[key] = r.value;
  }
  return Object.keys(out).length ? out : null;
}

export function InvestorProfileEditor(props: {
  value: EnrichedInvestorProfile;
  onChange: (next: EnrichedInvestorProfile) => void;
  readOnlyProvenance?: boolean;
  flat?: boolean;
  readOnly?: boolean;
}) {
  const {
    value,
    onChange,
    readOnlyProvenance = true,
    flat = false,
    readOnly = false,
  } = props;

  const [buysInput, setBuysInput] = useState("");
  const [sellsInput, setSellsInput] = useState("");

  const [holdingsRows, setHoldingsRows] = useState<HoldingRow[]>(() =>
    asHoldingsRows((value.top_holdings as any) ?? null)
  );
  const [sectorRows, setSectorRows] = useState<SectorRow[]>(() =>
    asSectorRows((value.sector_exposure as any) ?? null)
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

  const [activeTab, setActiveTab] = useState("preference");

  return (
    <div className="space-y-6 pb-2">
      <Tabs
        defaultValue="preference"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="w-full justify-between text-xs">
          <TabsTrigger value="preference" className="text-xs">
            Prefs
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="text-xs">
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="background" className="text-xs">
            Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preference" className="space-y-4">
          <PreferenceFormContent
            value={value}
            onChange={onChange}
            safeAum={safeAum}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-3">
          <PortfolioDNAContent
            value={value}
            onChange={onChange}
            holdingsRows={holdingsRows}
            setHoldingsRows={setHoldingsRows}
            holdingsChartData={holdingsChartData}
            sectorRows={sectorRows}
            setSectorRows={setSectorRows}
            sectorChartData={sectorChartData}
            buysInput={buysInput}
            setBuysInput={setBuysInput}
            sellsInput={sellsInput}
            setSellsInput={setSellsInput}
            applyStructured={applyStructured}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="background" className="space-y-3">
          <BackgroundContent
            value={value}
            onChange={onChange}
            readOnlyProvenance={readOnlyProvenance}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Sub-components for Form Content ---

function PreferenceFormContent({
  value,
  onChange,
  safeAum,
  readOnly = false,
}: {
  value: EnrichedInvestorProfile;
  onChange: (v: EnrichedInvestorProfile) => void;
  safeAum: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-md border border-border/30 bg-white/40 dark:bg-background/40 p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Risk tolerance
          </div>
          <Input
            value={value.risk_tolerance || ""}
            onChange={(e) =>
              onChange({ ...value, risk_tolerance: e.target.value })
            }
            disabled={readOnly}
            placeholder="balanced"
            className="h-9 text-sm mt-1 bg-transparent border-0 px-2 focus-visible:ring-0 shadow-none font-bold placeholder:font-normal disabled:opacity-100 disabled:cursor-default"
          />
        </div>
        <div className="rounded-md border border-border/30 bg-white/40 dark:bg-background/40 p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Time horizon
          </div>
          <Input
            value={value.time_horizon || ""}
            onChange={(e) =>
              onChange({ ...value, time_horizon: e.target.value })
            }
            disabled={readOnly}
            placeholder="long"
            className="h-9 text-sm mt-1 bg-transparent border-0 px-2 focus-visible:ring-0 shadow-none font-bold placeholder:font-normal disabled:opacity-100 disabled:cursor-default"
          />
        </div>
        <div className="rounded-md border border-border/30 bg-white/40 dark:bg-background/40 p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Portfolio turnover
          </div>
          <Input
            value={value.portfolio_turnover || ""}
            onChange={(e) =>
              onChange({ ...value, portfolio_turnover: e.target.value })
            }
            disabled={readOnly}
            placeholder="low"
            className="h-9 text-sm mt-1 bg-transparent border-0 px-2 focus-visible:ring-0 shadow-none font-bold placeholder:font-normal disabled:opacity-100 disabled:cursor-default"
          />
        </div>
        <div className="rounded-md border border-border/30 bg-white/40 dark:bg-background/40 p-4 shadow-sm">
          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            AUM (B)
          </div>
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
            disabled={readOnly}
            placeholder="—"
            className="h-9 text-sm mt-1 bg-transparent border-0 px-2 focus-visible:ring-0 shadow-none font-bold placeholder:font-normal disabled:opacity-100 disabled:cursor-default"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Investment style
        </div>
        <div className="flex flex-wrap gap-2">
          {INVESTMENT_STYLES.map((style) => {
            const isSelected = (value.investment_style || []).includes(style);
            return (
              <Badge
                key={style}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/50 hover:border-primary/50 hover:bg-primary/5",
                  readOnly && "cursor-default"
                )}
                onClick={() => {
                  if (readOnly) return;
                  if (isSelected) {
                    onChange({
                      ...value,
                      investment_style: (value.investment_style || []).filter(
                        (s) => s !== style
                      ),
                    });
                  } else {
                    onChange({
                      ...value,
                      investment_style: [
                        ...(value.investment_style || []),
                        style,
                      ],
                    });
                  }
                }}
              >
                {style}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PortfolioDNAContent({
  value,
  onChange,
  holdingsRows,
  setHoldingsRows,
  holdingsChartData,
  sectorRows,
  setSectorRows,
  sectorChartData,
  buysInput,
  setBuysInput,
  sellsInput,
  setSellsInput,
  applyStructured,
  readOnly = false,
}: {
  value: EnrichedInvestorProfile;
  onChange: (v: EnrichedInvestorProfile) => void;
  holdingsRows: HoldingRow[];
  setHoldingsRows: (r: HoldingRow[]) => void;
  holdingsChartData: any[];
  sectorRows: SectorRow[];
  setSectorRows: (r: SectorRow[]) => void;
  sectorChartData: any[];
  buysInput: string;
  setBuysInput: (v: string) => void;
  sellsInput: string;
  setSellsInput: (v: string) => void;
  applyStructured: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Top holdings
          </h4>
          {!readOnly && (
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
          )}
        </div>

        {holdingsChartData.length > 0 && (
          <div className="h-40 w-full mb-4 [&_svg]:outline-none **:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={holdingsChartData}>
                <XAxis
                  dataKey="ticker"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  cursor={{ fill: "hsl(var(--muted)/0.1)" }}
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

        <div className="space-y-2">
          {holdingsRows.map((r, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_110px_40px] gap-2 items-center"
            >
              <Input
                value={r.ticker}
                onChange={(e) => {
                  const next = [...holdingsRows];
                  next[idx] = {
                    ticker: e.target.value.toUpperCase(),
                    weight: r.weight ?? null,
                  };
                  setHoldingsRows(next);
                }}
                disabled={readOnly}
                placeholder="Ticker"
                className="h-9 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
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
                disabled={readOnly}
                placeholder="%"
                className="h-9 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
                inputMode="decimal"
              />
              {!readOnly && (
                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  showRipple
                  onClick={() => setHoldingsRows(removeAt(holdingsRows, idx))}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Sector exposure
          </h4>
          {!readOnly && (
            <Button
              variant="none"
              effect="glass"
              size="sm"
              showRipple
              onClick={() =>
                setSectorRows([...sectorRows, { sector: "", value: null }])
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>

        {sectorChartData.length > 0 && (
          <div className="h-44 w-full mb-4 [&_svg]:outline-none **:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
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

        <div className="space-y-2">
          {sectorRows.map((r, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_110px_40px] gap-2 items-center"
            >
              <Input
                value={r.sector}
                onChange={(e) => {
                  const next = [...sectorRows];
                  next[idx] = {
                    sector: e.target.value,
                    value: r.value ?? null,
                  };
                  setSectorRows(next);
                }}
                placeholder="Sector"
                className="h-9 text-sm rounded-lg border-border/50 bg-background/40"
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
                disabled={readOnly}
                placeholder="%"
                className="h-9 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
                inputMode="decimal"
              />
              {!readOnly && (
                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  showRipple
                  onClick={() => setSectorRows(removeAt(sectorRows, idx))}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Recent activity
        </h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">
              Recent buys
            </div>
            <div className="flex flex-wrap gap-2">
              {(value.recent_buys || []).map((t, idx) => (
                <Badge
                  key={`${t}-${idx}`}
                  variant="outline"
                  className="gap-1 rounded-lg border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                >
                  {t}
                  {!readOnly && (
                    <button
                      type="button"
                      className="opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() =>
                        onChange({
                          ...value,
                          recent_buys: removeAt(value.recent_buys || [], idx),
                        })
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  value={buysInput}
                  onChange={(e) => setBuysInput(e.target.value)}
                  placeholder="Add buy ticker"
                  className="h-9 text-sm rounded-lg border-border/50 bg-background/40"
                />
                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  showRipple
                  onClick={() => {
                    if (buysInput.trim()) {
                      onChange({
                        ...value,
                        recent_buys: uniqAdd(
                          value.recent_buys,
                          buysInput.trim().toUpperCase()
                        ),
                      });
                      setBuysInput("");
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">
              Recent sells
            </div>
            <div className="flex flex-wrap gap-2">
              {(value.recent_sells || []).map((t, idx) => (
                <Badge
                  key={`${t}-${idx}`}
                  variant="outline"
                  className="gap-1 rounded-lg border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400"
                >
                  {t}
                  {!readOnly && (
                    <button
                      type="button"
                      className="opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() =>
                        onChange({
                          ...value,
                          recent_sells: removeAt(value.recent_sells || [], idx),
                        })
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  value={sellsInput}
                  onChange={(e) => setSellsInput(e.target.value)}
                  placeholder="Add sell ticker"
                  className="h-9 text-sm rounded-lg border-border/50 bg-background/40"
                />
                <Button
                  variant="none"
                  effect="glass"
                  size="icon-sm"
                  showRipple
                  onClick={() => {
                    if (sellsInput.trim()) {
                      onChange({
                        ...value,
                        recent_sells: uniqAdd(
                          value.recent_sells,
                          sellsInput.trim().toUpperCase()
                        ),
                      });
                      setSellsInput("");
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundContent({
  value,
  onChange,
  readOnlyProvenance,
  readOnly = false,
}: {
  value: EnrichedInvestorProfile;
  onChange: (v: EnrichedInvestorProfile) => void;
  readOnlyProvenance: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Personal Information
        </h4>
        <div className="grid grid-cols-1 gap-2">
          <Input
            value={value.name || ""}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Full Name"
            disabled={readOnly}
            className="h-10 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={value.firm || ""}
              onChange={(e) => onChange({ ...value, firm: e.target.value })}
              placeholder="Firm"
              disabled={readOnly}
              className="h-10 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
            />
            <Input
              value={value.title || ""}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="Title"
              disabled={readOnly}
              className="h-10 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Biography
        </h4>
        <textarea
          value={value.biography || ""}
          onChange={(e) => onChange({ ...value, biography: e.target.value })}
          disabled={readOnly}
          className="w-full min-h-24 rounded-lg border border-border/50 bg-background/40 p-5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-100 disabled:cursor-default"
          placeholder="Investing philosophy, track record, etc."
        />
      </div>

      <div className="space-y-4 pt-2">
        <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Insider Status
        </h4>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/20">
          <input
            type="checkbox"
            id="is-insider-checkbox"
            checked={!!value.is_insider}
            onChange={(e) =>
              onChange({ ...value, is_insider: e.target.checked })
            }
            disabled={readOnly}
            className="w-4 h-4 rounded border-border/50 text-primary focus:ring-0 disabled:opacity-50"
          />
          <label
            htmlFor="is-insider-checkbox"
            className="text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
          >
            I AM AN INSIDER
          </label>
        </div>
        {value.is_insider && (
          <Input
            value={value.insider_company_ticker || ""}
            onChange={(e) =>
              onChange({
                ...value,
                insider_company_ticker: e.target.value.toUpperCase() || null,
              })
            }
            disabled={readOnly}
            placeholder="COMPANY TICKER"
            className="h-10 text-sm rounded-lg border-border/50 bg-background/40 disabled:opacity-100 disabled:cursor-default"
          />
        )}
      </div>

      <Card variant="muted" effect="glass" showRipple={false}>
        <CardContent className="p-4 space-y-4">
          <h4 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Data Provenance
          </h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
                Data Sources
              </div>
              <Input
                value={listToCsv((value.data_sources as any) || null)}
                onChange={(e) => {
                  onChange({
                    ...value,
                    data_sources: csvToList(e.target.value),
                  });
                }}
                placeholder="SEC EDGAR, Form 13F, Form 4"
                className="h-9 text-xs bg-background/40 border border-border/50 rounded-lg px-2 shadow-none disabled:opacity-100 disabled:cursor-default"
                disabled={readOnly}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
                  13F Date
                </div>
                <Input
                  type="date"
                  value={(value.last_13f_date as any) || ""}
                  onChange={(e) =>
                    onChange({ ...value, last_13f_date: e.target.value as any })
                  }
                  className="h-9 text-xs bg-background/40 border border-border/50 rounded-lg px-2 shadow-none disabled:opacity-100 disabled:cursor-default"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
                  Form 4 Date
                </div>
                <Input
                  type="date"
                  value={(value.last_form4_date as any) || ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      last_form4_date: e.target.value as any,
                    })
                  }
                  className="h-9 text-xs bg-background/40 border border-border/50 rounded-lg px-2 shadow-none disabled:opacity-100 disabled:cursor-default"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
