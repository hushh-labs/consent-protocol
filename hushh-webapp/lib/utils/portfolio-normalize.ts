/**
 * Portfolio Data Normalizer
 * =========================
 *
 * When portfolio data is saved to the World Model, it uses the
 * ReviewPortfolioData field names (from portfolio-review-view.tsx).
 * When the Dashboard and Manage pages load it back, they expect the
 * DashboardPortfolioData field names (from dashboard-view.tsx).
 *
 * This module bridges the gap by detecting which shape the data is in
 * and normalising to the Dashboard shape. It is safe to call on data
 * that is already in Dashboard format — the function is idempotent.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

/**
 * Normalize a stored portfolio blob into Dashboard-compatible format.
 *
 * Handles Review-format field names (holder_name, brokerage, cash_pct,
 * dividends_taxable, interest_income, total_income, short_term_gain,
 * long_term_gain, net_realized) and maps them to Dashboard names
 * (account_holder, brokerage_name, cash_percent, dividends, interest,
 * total, short_term, long_term, total).
 *
 * Also computes missing `unrealized_gain_loss_pct` on holdings.
 */
export function normalizeStoredPortfolio(raw: AnyObj): AnyObj {
  if (!raw || typeof raw !== "object") return raw;

  // If it's already Dashboard-format, return as-is (detect via brokerage_name)
  const ai = raw.account_info;

  const normalizedAccountInfo = ai
    ? {
        account_number: ai.account_number,
        account_type: ai.account_type,
        // Map Review → Dashboard, keep Dashboard field if already present
        brokerage_name: ai.brokerage_name || ai.brokerage || undefined,
        institution_name: ai.institution_name || ai.brokerage || undefined,
        account_holder: ai.account_holder || ai.holder_name || undefined,
        statement_period: ai.statement_period,
        statement_period_start: ai.statement_period_start,
        statement_period_end: ai.statement_period_end,
      }
    : undefined;

  const as = raw.account_summary;
  const normalizedAccountSummary = as
    ? {
        beginning_value: as.beginning_value,
        ending_value: as.ending_value ?? raw.total_value ?? 0,
        change_in_value: as.change_in_value,
        cash_balance: as.cash_balance,
        equities_value: as.equities_value,
        total_change: as.total_change,
        net_deposits_withdrawals: as.net_deposits_withdrawals,
        investment_gain_loss: as.investment_gain_loss,
      }
    : undefined;

  const aa = raw.asset_allocation;
  // asset_allocation can be an object or an array (category breakdown)
  const normalizedAssetAllocation = aa
    ? Array.isArray(aa)
      ? aa
      : {
          cash_percent: aa.cash_percent ?? aa.cash_pct ?? aa.cash_value,
          cash_pct: aa.cash_pct ?? aa.cash_percent,
          equities_percent: aa.equities_percent ?? aa.equities_pct ?? aa.equities_value,
          equities_pct: aa.equities_pct ?? aa.equities_percent,
          bonds_percent: aa.bonds_percent ?? aa.bonds_pct ?? aa.bonds_value,
          bonds_pct: aa.bonds_pct ?? aa.bonds_percent,
          other_percent: aa.other_percent,
        }
    : undefined;

  const is = raw.income_summary;
  const normalizedIncomeSummary = is
    ? {
        dividends: is.dividends ?? is.dividends_taxable,
        interest: is.interest ?? is.interest_income,
        total: is.total ?? is.total_income,
        // Keep additional fields that may be present
        ...(is.qualified_dividends !== undefined
          ? { qualified_dividends: is.qualified_dividends }
          : {}),
        ...(is.non_qualified_dividends !== undefined
          ? { non_qualified_dividends: is.non_qualified_dividends }
          : {}),
      }
    : undefined;

  const rgl = raw.realized_gain_loss;
  const normalizedRealizedGainLoss = rgl
    ? {
        short_term: rgl.short_term ?? rgl.short_term_gain,
        short_term_gain: rgl.short_term_gain ?? rgl.short_term,
        long_term: rgl.long_term ?? rgl.long_term_gain,
        long_term_gain: rgl.long_term_gain ?? rgl.long_term,
        total: rgl.total ?? rgl.net_realized,
        net_realized: rgl.net_realized ?? rgl.total,
        // Keep additional fields
        ...(rgl.short_term_loss !== undefined
          ? { short_term_loss: rgl.short_term_loss }
          : {}),
        ...(rgl.long_term_loss !== undefined
          ? { long_term_loss: rgl.long_term_loss }
          : {}),
      }
    : undefined;

  // Normalize holdings: compute missing unrealized_gain_loss_pct
  const normalizedHoldings = normalizeHoldingsPct(raw.holdings);

  return {
    ...raw,
    account_info: normalizedAccountInfo,
    account_summary: normalizedAccountSummary,
    asset_allocation: normalizedAssetAllocation,
    income_summary: normalizedIncomeSummary,
    realized_gain_loss: normalizedRealizedGainLoss,
    holdings: normalizedHoldings,
    // Preserve additional dashboard-only fields if present
    detailed_holdings: raw.detailed_holdings,
    transactions: raw.transactions || [],
    activity_and_transactions: raw.activity_and_transactions,
    historical_values: raw.historical_values,
    cash_flow: raw.cash_flow,
    cash_management: raw.cash_management,
    cash_balance: raw.cash_balance,
    total_value: raw.total_value,
    ytd_metrics: raw.ytd_metrics,
    ytd_summary: raw.ytd_summary,
    total_fees: raw.total_fees,
    projections_and_mrd: raw.projections_and_mrd,
    legal_and_disclosures: raw.legal_and_disclosures,
  };
}

/**
 * Ensure each holding has `unrealized_gain_loss_pct` computed.
 */
function normalizeHoldingsPct(holdings: AnyObj[] | undefined): AnyObj[] | undefined {
  if (!holdings || !Array.isArray(holdings)) return holdings;

  return holdings.map((h) => {
    // If percentage is already present and valid, keep it
    if (
      h.unrealized_gain_loss_pct !== undefined &&
      h.unrealized_gain_loss_pct !== 0
    ) {
      return h;
    }

    const unrealized = h.unrealized_gain_loss;
    const costBasis = h.cost_basis;
    const marketValue = h.market_value;

    if (typeof unrealized === "number" && typeof costBasis === "number" && costBasis > 0) {
      return { ...h, unrealized_gain_loss_pct: (unrealized / costBasis) * 100 };
    }
    if (typeof costBasis === "number" && typeof marketValue === "number" && costBasis > 0) {
      const gain = marketValue - costBasis;
      return {
        ...h,
        unrealized_gain_loss: h.unrealized_gain_loss ?? gain,
        unrealized_gain_loss_pct: (gain / costBasis) * 100,
      };
    }
    return h;
  });
}
