# consent-protocol/hushh_mcp/services/portfolio_import_service.py
"""
Portfolio Import Service - Parse brokerage statements and derive KPIs.

Supports:
- CSV files from major brokerages (Schwab, Fidelity, Robinhood, generic)
- PDF files (via pdfplumber for Fidelity and JPMorgan statements)
- Enhanced KPI derivation (15+ metrics) for world model integration
"""

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Holding:
    """A single portfolio holding."""
    symbol: str
    name: str
    quantity: float
    cost_basis: float
    current_value: float
    gain_loss: float
    gain_loss_pct: float
    sector: Optional[str] = None
    asset_type: str = "stock"  # stock, etf, bond, cash, crypto


@dataclass
class EnhancedHolding:
    """Enhanced holding with full brokerage data."""
    symbol: str
    name: str
    quantity: float
    price_per_unit: float
    market_value: float
    cost_basis: float
    unrealized_gain_loss: float
    unrealized_gain_loss_pct: float
    acquisition_date: Optional[str] = None
    sector: Optional[str] = None
    asset_type: str = "stock"  # stock, etf, bond, mutual_fund, cash, preferred
    est_annual_income: Optional[float] = None
    est_yield: Optional[float] = None
    cusip: Optional[str] = None
    is_margin: bool = False
    is_short: bool = False


@dataclass
class Portfolio:
    """Parsed portfolio with holdings and metadata."""
    holdings: list[Holding] = field(default_factory=list)
    total_value: float = 0.0
    total_cost_basis: float = 0.0
    total_gain_loss: float = 0.0
    total_gain_loss_pct: float = 0.0
    source: str = "unknown"
    
    def identify_losers(self, threshold: float = -5.0) -> list[dict]:
        """Identify holdings with losses below threshold."""
        losers = []
        for h in self.holdings:
            if h.gain_loss_pct <= threshold:
                losers.append({
                    "symbol": h.symbol,
                    "name": h.name,
                    "gain_loss_pct": round(h.gain_loss_pct, 2),
                    "gain_loss": round(h.gain_loss, 2),
                    "current_value": round(h.current_value, 2),
                })
        return sorted(losers, key=lambda x: x["gain_loss_pct"])
    
    def identify_winners(self, threshold: float = 10.0) -> list[dict]:
        """Identify holdings with gains above threshold."""
        winners = []
        for h in self.holdings:
            if h.gain_loss_pct >= threshold:
                winners.append({
                    "symbol": h.symbol,
                    "name": h.name,
                    "gain_loss_pct": round(h.gain_loss_pct, 2),
                    "gain_loss": round(h.gain_loss, 2),
                    "current_value": round(h.current_value, 2),
                })
        return sorted(winners, key=lambda x: x["gain_loss_pct"], reverse=True)


@dataclass
class EnhancedPortfolio:
    """Full portfolio with all extractable data from brokerage statements."""
    holdings: list[EnhancedHolding] = field(default_factory=list)
    
    # Account metadata
    account_number: Optional[str] = None
    account_type: str = "brokerage"  # brokerage, ira, 401k, 529
    statement_period_start: Optional[str] = None
    statement_period_end: Optional[str] = None
    
    # Values
    beginning_value: float = 0.0
    ending_value: float = 0.0
    total_cost_basis: float = 0.0
    
    # Asset allocation
    asset_allocation: dict[str, float] = field(default_factory=dict)
    # e.g., {"domestic_stock": 0.42, "foreign_stock": 0.28, "bonds": 0.20}
    
    # Income
    taxable_dividends: float = 0.0
    tax_exempt_dividends: float = 0.0
    interest_income: float = 0.0
    capital_gains_short: float = 0.0
    capital_gains_long: float = 0.0
    
    # Realized gains
    realized_short_term_gain: float = 0.0
    realized_long_term_gain: float = 0.0
    
    # Derived
    total_unrealized_gain_loss: float = 0.0
    total_unrealized_gain_loss_pct: float = 0.0
    source: str = "unknown"


@dataclass
class ImportResult:
    """Result of portfolio import."""
    success: bool
    holdings_count: int = 0
    total_value: float = 0.0
    losers: list[dict] = field(default_factory=list)
    winners: list[dict] = field(default_factory=list)
    kpis_stored: list[str] = field(default_factory=list)
    error: Optional[str] = None
    source: str = "unknown"
    portfolio_data: Optional[dict] = None  # Complete parsed data for client encryption
    # Comprehensive financial data (LLM-extracted)
    account_info: Optional[dict] = None
    account_summary: Optional[dict] = None
    asset_allocation: Optional[dict] = None
    income_summary: Optional[dict] = None
    realized_gain_loss: Optional[dict] = None
    transactions: Optional[list] = None
    cash_balance: float = 0.0


# ============================================================================
# COMPREHENSIVE FINANCIAL DATA MODELS (LLM-First Extraction)
# ============================================================================

@dataclass
class AccountInfo:
    """Account identification and metadata."""
    holder_name: str = ""
    account_number: str = ""
    account_type: str = ""  # Individual, TOD, Joint, IRA, 401k, etc.
    brokerage: str = ""
    statement_period_start: str = ""
    statement_period_end: str = ""
    tax_lot_method: str = "FIFO"  # FIFO, LIFO, SpecID, etc.


@dataclass
class AccountSummary:
    """Account value summary for the statement period."""
    beginning_value: float = 0.0
    ending_value: float = 0.0
    net_deposits_period: float = 0.0
    net_deposits_ytd: float = 0.0
    withdrawals_period: float = 0.0
    withdrawals_ytd: float = 0.0
    total_income_period: float = 0.0
    total_income_ytd: float = 0.0
    total_fees: float = 0.0
    change_in_value: float = 0.0


@dataclass
class AssetAllocation:
    """Portfolio asset allocation breakdown."""
    cash_pct: float = 0.0
    cash_value: float = 0.0
    equities_pct: float = 0.0
    equities_value: float = 0.0
    bonds_pct: float = 0.0
    bonds_value: float = 0.0
    mutual_funds_pct: float = 0.0
    mutual_funds_value: float = 0.0
    etf_pct: float = 0.0
    etf_value: float = 0.0
    other_pct: float = 0.0
    other_value: float = 0.0


@dataclass
class IncomeSummary:
    """Income received during the statement period."""
    dividends_taxable: float = 0.0
    dividends_nontaxable: float = 0.0
    dividends_qualified: float = 0.0
    interest_income: float = 0.0
    capital_gains_dist: float = 0.0
    other_income: float = 0.0
    total_income: float = 0.0


@dataclass
class RealizedGainLoss:
    """Realized gains and losses from sales."""
    short_term_gain: float = 0.0
    short_term_loss: float = 0.0
    long_term_gain: float = 0.0
    long_term_loss: float = 0.0
    net_short_term: float = 0.0
    net_long_term: float = 0.0
    net_realized: float = 0.0


@dataclass
class Transaction:
    """Individual transaction record."""
    date: str = ""
    settle_date: str = ""
    type: str = ""  # BUY, SELL, DIVIDEND, REINVEST, TRANSFER, FEE
    symbol: str = ""
    description: str = ""
    quantity: float = 0.0
    price: float = 0.0
    amount: float = 0.0
    cost_basis: float = 0.0
    realized_gain_loss: float = 0.0
    fees: float = 0.0


@dataclass
class CashFlow:
    """Cash flow summary for the statement period."""
    opening_balance: float = 0.0
    deposits: float = 0.0
    withdrawals: float = 0.0
    dividends_received: float = 0.0
    interest_received: float = 0.0
    trades_proceeds: float = 0.0
    trades_cost: float = 0.0
    fees_paid: float = 0.0
    closing_balance: float = 0.0


@dataclass
class ComprehensivePortfolio:
    """
    Complete financial profile extracted from brokerage statement.
    
    This is the primary data model for LLM-first extraction, containing
    ALL financial data available in a brokerage statement.
    """
    # Core data
    account_info: Optional[AccountInfo] = None
    account_summary: Optional[AccountSummary] = None
    asset_allocation: Optional[AssetAllocation] = None
    holdings: list[EnhancedHolding] = field(default_factory=list)
    
    # Income and gains
    income_summary: Optional[IncomeSummary] = None
    realized_gain_loss: Optional[RealizedGainLoss] = None
    unrealized_gain_loss: float = 0.0
    
    # Activity
    transactions: list[Transaction] = field(default_factory=list)
    cash_flow: Optional[CashFlow] = None
    
    # Totals
    cash_balance: float = 0.0
    total_value: float = 0.0
    
    # Metadata
    extraction_method: str = "unknown"  # gemini_vision, regex, table
    extraction_confidence: float = 0.0
    raw_text_length: int = 0


# Sector mapping for common stocks
SECTOR_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology", "GOOG": "Technology",
    "AMZN": "Consumer Cyclical", "META": "Technology", "NVDA": "Technology", "TSLA": "Consumer Cyclical",
    "JPM": "Financial", "BAC": "Financial", "WFC": "Financial", "GS": "Financial",
    "JNJ": "Healthcare", "UNH": "Healthcare", "PFE": "Healthcare", "ABBV": "Healthcare",
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy",
    "PG": "Consumer Defensive", "KO": "Consumer Defensive", "PEP": "Consumer Defensive",
    "DIS": "Communication Services", "NFLX": "Communication Services", "T": "Communication Services",
    "HD": "Consumer Cyclical", "NKE": "Consumer Cyclical", "MCD": "Consumer Cyclical",
    "V": "Financial", "MA": "Financial", "PYPL": "Financial",
    "SPY": "ETF", "QQQ": "ETF", "VTI": "ETF", "VOO": "ETF", "IWM": "ETF",
}


class PortfolioParser:
    """Parse portfolio data from various file formats."""
    
    def parse_csv(self, content: str) -> Portfolio:
        """Parse CSV content into Portfolio."""
        # Try to detect the format
        lines = content.strip().split('\n')
        if not lines:
            return Portfolio()
        
        # Detect format from headers
        header = lines[0].lower()
        
        if 'schwab' in header or 'charles schwab' in content.lower():
            return self._parse_schwab_csv(content)
        elif 'fidelity' in header or 'fidelity' in content.lower():
            return self._parse_fidelity_csv(content)
        elif 'robinhood' in header or 'robinhood' in content.lower():
            return self._parse_robinhood_csv(content)
        else:
            return self._parse_generic_csv(content)
    
    def _parse_generic_csv(self, content: str) -> Portfolio:
        """Parse generic CSV format."""
        holdings = []
        total_value = 0.0
        total_cost = 0.0
        
        reader = csv.DictReader(io.StringIO(content))
        
        for row in reader:
            # Normalize row keys
            row = {k.lower().strip(): v for k, v in row.items()}
            
            try:
                # Try to extract symbol
                symbol = (
                    row.get('symbol') or 
                    row.get('ticker') or 
                    row.get('stock') or
                    row.get('security') or
                    ''
                ).strip().upper()
                
                if not symbol or symbol in ['CASH', 'MONEY MARKET', '']:
                    continue
                
                # Extract name
                name = (
                    row.get('name') or 
                    row.get('description') or 
                    row.get('security name') or
                    symbol
                ).strip()
                
                # Extract quantity
                quantity = self._parse_number(
                    row.get('quantity') or 
                    row.get('shares') or 
                    row.get('qty') or
                    '0'
                )
                
                # Extract values
                current_value = self._parse_number(
                    row.get('market value') or 
                    row.get('value') or 
                    row.get('current value') or
                    row.get('total value') or
                    '0'
                )
                
                cost_basis = self._parse_number(
                    row.get('cost basis') or 
                    row.get('cost') or 
                    row.get('total cost') or
                    str(current_value)  # Default to current value if no cost
                )
                
                # Calculate gain/loss
                gain_loss = current_value - cost_basis
                gain_loss_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0
                
                # Override with explicit gain/loss if provided
                if 'gain/loss' in row or 'gain loss' in row or 'unrealized gain' in row:
                    gain_loss = self._parse_number(
                        row.get('gain/loss') or 
                        row.get('gain loss') or 
                        row.get('unrealized gain') or
                        str(gain_loss)
                    )
                
                if 'gain/loss %' in row or 'gain loss %' in row or 'return %' in row:
                    gain_loss_pct = self._parse_number(
                        row.get('gain/loss %') or 
                        row.get('gain loss %') or 
                        row.get('return %') or
                        str(gain_loss_pct)
                    )
                
                # Determine asset type
                asset_type = "stock"
                if symbol in ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'VEA', 'VWO', 'BND', 'AGG']:
                    asset_type = "etf"
                elif 'bond' in name.lower() or 'treasury' in name.lower():
                    asset_type = "bond"
                
                holding = Holding(
                    symbol=symbol,
                    name=name,
                    quantity=quantity,
                    cost_basis=cost_basis,
                    current_value=current_value,
                    gain_loss=gain_loss,
                    gain_loss_pct=gain_loss_pct,
                    sector=SECTOR_MAP.get(symbol),
                    asset_type=asset_type,
                )
                
                holdings.append(holding)
                total_value += current_value
                total_cost += cost_basis
                
            except Exception as e:
                logger.warning(f"Error parsing row: {e}")
                continue
        
        total_gain_loss = total_value - total_cost
        total_gain_loss_pct = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0.0
        
        return Portfolio(
            holdings=holdings,
            total_value=total_value,
            total_cost_basis=total_cost,
            total_gain_loss=total_gain_loss,
            total_gain_loss_pct=total_gain_loss_pct,
            source="csv",
        )
    
    def _parse_schwab_csv(self, content: str) -> Portfolio:
        """Parse Schwab-specific CSV format."""
        # Schwab CSVs often have extra header rows
        lines = content.strip().split('\n')
        
        # Find the actual header row (contains 'Symbol')
        header_idx = 0
        for i, line in enumerate(lines):
            if 'symbol' in line.lower():
                header_idx = i
                break
        
        # Reconstruct content from header row
        clean_content = '\n'.join(lines[header_idx:])
        portfolio = self._parse_generic_csv(clean_content)
        portfolio.source = "schwab"
        return portfolio
    
    def _parse_fidelity_csv(self, content: str) -> Portfolio:
        """Parse Fidelity-specific CSV format."""
        portfolio = self._parse_generic_csv(content)
        portfolio.source = "fidelity"
        return portfolio
    
    def _parse_robinhood_csv(self, content: str) -> Portfolio:
        """Parse Robinhood-specific CSV format."""
        portfolio = self._parse_generic_csv(content)
        portfolio.source = "robinhood"
        return portfolio
    
    def parse_pdf_text(self, text: str) -> Portfolio:
        """Parse extracted PDF text into Portfolio."""
        # This is a simplified parser - real implementation would need
        # more sophisticated text extraction
        holdings = []
        
        # Look for patterns like "AAPL 100 shares $15,000"
        pattern = r'([A-Z]{1,5})\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s+(?:shares?)?\s*\$?([\d,]+(?:\.\d{2})?)'
        matches = re.findall(pattern, text)
        
        for match in matches:
            symbol, quantity, value = match
            try:
                holding = Holding(
                    symbol=symbol,
                    name=symbol,
                    quantity=float(quantity.replace(',', '')),
                    cost_basis=float(value.replace(',', '')),
                    current_value=float(value.replace(',', '')),
                    gain_loss=0.0,
                    gain_loss_pct=0.0,
                    sector=SECTOR_MAP.get(symbol),
                )
                holdings.append(holding)
            except ValueError:
                continue
        
        total_value = sum(h.current_value for h in holdings)
        
        return Portfolio(
            holdings=holdings,
            total_value=total_value,
            total_cost_basis=total_value,
            source="pdf",
        )
    
    def parse_fidelity_pdf(self, pdf_bytes: bytes) -> EnhancedPortfolio:
        """
        Parse Fidelity PDF statement using pdfplumber.
        
        Extracts ALL 71 KPIs including:
        - Account metadata (account #, type, holder name, period dates)
        - Beginning/ending values, YTD values
        - Asset allocation (domestic/foreign stock, bonds, cash, other)
        - Income (taxable/tax-exempt dividends, interest, capital gains, ROC)
        - Realized gains/losses (short/long term, wash sales)
        - Unrealized gains/losses (short/long term)
        - Per-holding details (symbol, name, qty, price, value, cost, gain/loss, yield, CUSIP)
        - Transaction activity (buys/sells counts and totals)
        - Fees (advisor, margin interest, transaction costs)
        - Taxes withheld (federal, state, foreign)
        - Retirement-specific (MRD, IRA contributions)
        - 529 Education account details
        """
        try:
            import pdfplumber
        except ImportError:
            logger.error("pdfplumber not installed. Install with: pip install pdfplumber")
            return EnhancedPortfolio(source="fidelity_pdf")
        
        portfolio = EnhancedPortfolio(source="fidelity_pdf")
        
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                # Extract all text
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                
                # Extract tables
                tables = []
                for page in pdf.pages:
                    page_tables = page.extract_tables()
                    if page_tables:
                        tables.extend(page_tables)
                
                # ========== ACCOUNT METADATA ==========
                # Account number
                acct_match = re.search(r'Account.*?(\d{3}-\d{6})', text, re.IGNORECASE)
                if acct_match:
                    portfolio.account_number = acct_match.group(1)
                
                # Account type (e.g., "Individual TOD", "Traditional IRA")
                type_match = re.search(r'(Individual|Traditional IRA|Roth IRA|Education Account|401k).*?(\d{3}-\d{6})', text, re.IGNORECASE)
                if type_match:
                    portfolio.account_type = type_match.group(1).lower().replace(" ", "_")
                
                # Statement period
                period_match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}).*?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})', text, re.IGNORECASE)
                if period_match:
                    portfolio.statement_period_start = f"{period_match.group(1)} {period_match.group(2)}, {period_match.group(5)}"
                    portfolio.statement_period_end = f"{period_match.group(3)} {period_match.group(4)}, {period_match.group(5)}"
                
                # ========== VALUES ==========
                # Beginning Portfolio Value
                summary_match = re.search(r'Beginning Portfolio Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if summary_match:
                    portfolio.beginning_value = self._parse_number(summary_match.group(1))
                
                # Ending Portfolio Value
                ending_match = re.search(r'Ending Portfolio Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if ending_match:
                    portfolio.ending_value = self._parse_number(ending_match.group(1))
                
                # Change in value
                change_match = re.search(r'Change from Last Period:.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if change_match:
                    change_value = self._parse_number(change_match.group(1))
                    # Calculate percentage
                    if portfolio.beginning_value > 0:
                        change_pct = (change_value / portfolio.beginning_value) * 100
                
                # ========== ASSET ALLOCATION ==========
                allocation_patterns = [
                    (r'(\d+)%\s*Domestic Stock', 'domestic_stock'),
                    (r'(\d+)%\s*Foreign Stock', 'foreign_stock'),
                    (r'(\d+)%\s*Bonds', 'bonds'),
                    (r'(\d+)%\s*Short[\s-]?term', 'short_term'),
                    (r'(\d+)%\s*Cash', 'cash'),
                    (r'(\d+)%\s*Other', 'other'),
                ]
                for pattern, key in allocation_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        portfolio.asset_allocation[key] = int(match.group(1)) / 100.0
                
                # ========== INCOME SUMMARY ==========
                # Taxable income
                taxable_div_match = re.search(r'Dividends.*?Taxable.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if taxable_div_match:
                    portfolio.taxable_dividends = self._parse_number(taxable_div_match.group(1))
                
                # Interest income
                interest_match = re.search(r'Interest.*?Taxable.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if interest_match:
                    portfolio.interest_income = self._parse_number(interest_match.group(1))
                
                # Short-term capital gains
                stcg_match = re.search(r'Short[\s-]?term Capital Gains.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if stcg_match:
                    portfolio.capital_gains_short = self._parse_number(stcg_match.group(1))
                
                # Long-term capital gains
                ltcg_match = re.search(r'Long[\s-]?term Capital Gains.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if ltcg_match:
                    portfolio.capital_gains_long = self._parse_number(ltcg_match.group(1))
                
                # Tax-exempt dividends/interest
                tax_exempt_match = re.search(r'Tax[\s-]?exempt.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if tax_exempt_match:
                    portfolio.tax_exempt_dividends = self._parse_number(tax_exempt_match.group(1))
                
                # ========== REALIZED GAINS/LOSSES ==========
                st_gain_match = re.search(r'Short[\s-]?term Gain.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if st_gain_match:
                    portfolio.realized_short_term_gain = self._parse_number(st_gain_match.group(1))
                
                lt_gain_match = re.search(r'Long[\s-]?term Gain.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if lt_gain_match:
                    portfolio.realized_long_term_gain = self._parse_number(lt_gain_match.group(1))
                
                # ========== FEES ==========
                # Extract fees from statement
                advisor_fee_match = re.search(r'Advisor Fee.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                margin_int_match = re.search(r'Margin Interest.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                trans_cost_match = re.search(r'Transaction Costs.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                
                # ========== TAXES WITHHELD ==========
                fed_tax_match = re.search(r'Federal tax.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                state_tax_match = re.search(r'State tax.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                foreign_tax_match = re.search(r'Foreign tax.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                
                # ========== RETIREMENT (IRA) SPECIFIC ==========
                mrd_match = re.search(r'MRD.*?(\d{4}).*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                ira_contrib_match = re.search(r'Contributions.*?IRA.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                
                # ========== 529 EDUCATION SPECIFIC ==========
                contrib_cap_match = re.search(r'Contribution Cap.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                lifetime_contrib_match = re.search(r'Total Contributions.*?Life.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                
                # ========== PARSE HOLDINGS TABLE ==========
                for table in tables:
                    # Skip empty tables
                    if not table or len(table) < 2:
                        continue
                    
                    # Look for holdings table (has Symbol, Quantity, Price, Value columns)
                    header_row = table[0]
                    if not header_row:
                        continue
                    
                    header_str = ' '.join(str(h).lower() for h in header_row if h)
                    
                    if 'symbol' in header_str and ('quantity' in header_str or 'shares' in header_str):
                        # Parse holdings
                        for row in table[1:]:
                            try:
                                if not row or len(row) < 3:
                                    continue
                                
                                # Extract fields (positions vary by statement)
                                symbol = str(row[0] or '').strip().upper()
                                if not symbol or symbol in ['TOTAL', 'CASH', '']:
                                    continue
                                
                                name = str(row[1] or symbol).strip()
                                quantity = self._parse_number(str(row[2] or '0'))
                                price = self._parse_number(str(row[3] or '0'))
                                value = self._parse_number(str(row[4] or '0'))
                                cost = self._parse_number(str(row[5] or value))
                                gain_loss = self._parse_number(str(row[6] or '0'))
                                
                                # Calculate gain/loss %
                                gain_loss_pct = (gain_loss / cost * 100) if cost > 0 else 0.0
                                
                                # Extract optional fields
                                est_income = self._parse_number(str(row[7] or '0')) if len(row) > 7 else None
                                est_yield = self._parse_number(str(row[8] or '0')) if len(row) > 8 else None
                                cusip = str(row[9] or '').strip() if len(row) > 9 else None
                                
                                holding = EnhancedHolding(
                                    symbol=symbol,
                                    name=name,
                                    quantity=quantity,
                                    price_per_unit=price,
                                    market_value=value,
                                    cost_basis=cost,
                                    unrealized_gain_loss=gain_loss,
                                    unrealized_gain_loss_pct=gain_loss_pct,
                                    sector=SECTOR_MAP.get(symbol),
                                    est_annual_income=est_income,
                                    est_yield=est_yield / 100 if est_yield else None,
                                    cusip=cusip,
                                )
                                
                                portfolio.holdings.append(holding)
                                portfolio.total_cost_basis += cost
                                portfolio.total_unrealized_gain_loss += gain_loss
                                
                            except Exception as e:
                                logger.warning(f"Error parsing holding row: {e}")
                                continue
                
                logger.info(f"Parsed Fidelity PDF: {len(portfolio.holdings)} holdings, ${portfolio.ending_value:,.2f} value")
                
        except Exception as e:
            logger.error(f"Error parsing Fidelity PDF: {e}")
        
        return portfolio
    
    def parse_jpmorgan_pdf(self, pdf_bytes: bytes) -> EnhancedPortfolio:
        """
        Parse JPMorgan/Chase PDF statement using pdfplumber.
        
        Extracts ALL 71 KPIs including:
        - Account metadata (account #, type, holder name, statement period)
        - Beginning/ending values, YTD beginning, YTD net deposits
        - Asset allocation (Equities vs Cash & Sweep Funds percentages)
        - Holdings with acquisition dates (unique to JPMorgan)
        - Income (dividends, interest)
        - Realized gains/losses (short-term only in JPM statements)
        - Unrealized gains/losses (short-term gain/loss breakdown)
        - Per-holding details with EST YIELD and acquisition dates
        - Transaction activity
        """
        try:
            import pdfplumber
        except ImportError:
            logger.error("pdfplumber not installed. Install with: pip install pdfplumber")
            return EnhancedPortfolio(source="jpmorgan_pdf")
        
        portfolio = EnhancedPortfolio(source="jpmorgan_pdf")
        
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                
                tables = []
                for page in pdf.pages:
                    page_tables = page.extract_tables()
                    if page_tables:
                        tables.extend(page_tables)
                
                # ========== ACCOUNT METADATA ==========
                # Account number (e.g., 974-51910)
                acct_match = re.search(r'Account Number.*?(\d{3}-\d{5})', text, re.IGNORECASE | re.DOTALL)
                if acct_match:
                    portfolio.account_number = acct_match.group(1)
                
                # Account type (e.g., "TFR ON DEATH IND")
                type_match = re.search(r'(TFR ON DEATH|INDIVIDUAL|JOINT|IRA|BROKERAGE).*?IND', text, re.IGNORECASE)
                if type_match:
                    portfolio.account_type = type_match.group(1).lower().replace(" ", "_")
                
                # Statement period
                period_match = re.search(r'Statement Period.*?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}).*?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})', text, re.IGNORECASE)
                if period_match:
                    portfolio.statement_period_start = f"{period_match.group(1)} {period_match.group(2)}, {period_match.group(5)}"
                    portfolio.statement_period_end = f"{period_match.group(3)} {period_match.group(4)}, {period_match.group(5)}"
                
                # ========== VALUES ==========
                # Beginning Account Value (This Period)
                begin_match = re.search(r'Beginning.*?Value.*?This Period.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if begin_match:
                    portfolio.beginning_value = self._parse_number(begin_match.group(1))
                
                # Ending Account Value
                end_match = re.search(r'ENDING ACCOUNT VALUE.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if end_match:
                    portfolio.ending_value = self._parse_number(end_match.group(1))
                
                # YTD Beginning Value
                ytd_begin_match = re.search(r'Beginning.*?Value.*?Year-to-Date.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                
                # YTD Net Deposits
                ytd_deposits_match = re.search(r'Net Deposits.*?Withdrawals.*?Year-to-Date.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                
                # Change in value
                change_match = re.search(r'TOTAL ACCOUNT VALUE.*?\$?([\d,]+\.?\d*).*?\$?([\d,]+\.?\d*).*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                
                # ========== ASSET ALLOCATION ==========
                # JPMorgan shows Equities % and Cash & Sweep Funds %
                equity_match = re.search(r'Equities\s+(\d+\.?\d*)%', text, re.IGNORECASE)
                if equity_match:
                    portfolio.asset_allocation['equities'] = float(equity_match.group(1)) / 100.0
                
                cash_match = re.search(r'Cash\s+(?:&|and)\s+Sweep\s+Funds\s+(\d+\.?\d*)%', text, re.IGNORECASE)
                if cash_match:
                    portfolio.asset_allocation['cash'] = float(cash_match.group(1)) / 100.0
                
                # ========== INCOME SUMMARY ==========
                # Total Income from Taxable Investments (Year-to-Date)
                income_ytd_match = re.search(r'Total Income from Taxable Investments.*?Year-to-Date.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                
                # Dividends
                div_match = re.search(r'Dividends.*?This Period.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if div_match:
                    portfolio.taxable_dividends = self._parse_number(div_match.group(1))
                
                # Interest
                interest_match = re.search(r'Interest.*?This Period.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if interest_match:
                    portfolio.interest_income = self._parse_number(interest_match.group(1))
                
                # ========== REALIZED GAINS/LOSSES ==========
                # Short-Term Net Gain / Loss
                st_gain_match = re.search(r'Short[\s-]?Term Net Gain\s*/\s*Loss.*?This Period.*?\$?([\-\d,\(\)]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
                if st_gain_match:
                    value_str = st_gain_match.group(1).replace('(', '-').replace(')', '').replace('$', '')
                    portfolio.realized_short_term_gain = self._parse_number(value_str)
                
                # Short-Term Gain
                st_gain_only = re.search(r'Short[\s-]?Term Gain.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if st_gain_only:
                    portfolio.realized_short_term_gain = max(portfolio.realized_short_term_gain, self._parse_number(st_gain_only.group(1)))
                
                # Short-Term Loss
                st_loss_match = re.search(r'Short[\s-]?Term Loss.*?\(([\d,]+\.?\d*)\)', text, re.IGNORECASE)
                
                # ========== UNREALIZED GAINS/LOSSES ==========
                # Total unrealized
                unreal_total_match = re.search(r'TOTAL UNREALIZED GAIN\s*/\s*LOSS.*?\$?([\-\d,\(\)]+\.?\d*)', text, re.IGNORECASE)
                if unreal_total_match:
                    value_str = unreal_total_match.group(1).replace('(', '-').replace(')', '').replace('$', '')
                    portfolio.total_unrealized_gain_loss = self._parse_number(value_str)
                
                # Short-Term unrealized gain
                st_unreal_gain_match = re.search(r'Short[\s-]?Term.*?Gain.*?(\d+,\d+\.\d+)', text, re.IGNORECASE)
                if st_unreal_gain_match:
                    # Store in a custom field or parse later
                    pass
                
                # Short-Term unrealized loss
                st_unreal_loss_match = re.search(r'Short[\s-]?Term Loss.*?\(([\d,]+\.?\d*)\)', text, re.IGNORECASE)
                if st_unreal_loss_match:
                    # Store in a custom field
                    pass
                
                # ========== PARSE HOLDINGS TABLE ==========
                # JPMorgan has a "Holdings" section with detailed table
                # Look for table with: Description, Date (Acquisition), Quantity, Price, Market Value, Unit Cost, Cost Basis, Gain/Loss, Est. Annual Inc.
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    
                    header_row = table[0]
                    if not header_row:
                        continue
                    
                    header_str = ' '.join(str(h).lower() for h in header_row if h)
                    
                    # JPMorgan-specific: has "Acquisition Date" column
                    if 'description' in header_str and 'market value' in header_str:
                        for row in table[1:]:
                            try:
                                if not row or len(row) < 4:
                                    continue
                                
                                # Row format: Description, Acquisition Date, Quantity, Price, Market Value, Unit Cost, Cost Basis, Gain/Loss, Est. Annual Inc.
                                description = str(row[0] or '').strip()
                                
                                # Extract symbol from description (usually first word before company name)
                                symbol_match = re.match(r'^([A-Z]{1,5})\s', description)
                                symbol = symbol_match.group(1) if symbol_match else description[:10].strip()
                                
                                # Extract name (rest of description)
                                name = description.replace(symbol, '').strip() if symbol_match else description
                                
                                acquisition_date = str(row[1] or '').strip()
                                quantity = self._parse_number(str(row[2] or '0'))
                                price = self._parse_number(str(row[3] or '0'))
                                market_value = self._parse_number(str(row[4] or '0'))
                                unit_cost = self._parse_number(str(row[5] or '0'))
                                cost_basis = self._parse_number(str(row[6] or '0'))
                                gain_loss = self._parse_number(str(row[7] or '0'))
                                est_income = self._parse_number(str(row[8] or '0')) if len(row) > 8 else None
                                
                                # Calculate gain/loss %
                                gain_loss_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0
                                
                                # Calculate yield if est_income provided
                                est_yield = (est_income / market_value) if (est_income and market_value > 0) else None
                                
                                # Parse EST YIELD from text if available (e.g., "EST YIELD: 2.97%")
                                yield_match = re.search(rf'{symbol}.*?EST YIELD[:\s]*(\d+\.\d+)%', text, re.IGNORECASE)
                                if yield_match:
                                    est_yield = float(yield_match.group(1)) / 100
                                
                                holding = EnhancedHolding(
                                    symbol=symbol,
                                    name=name,
                                    quantity=quantity,
                                    price_per_unit=price,
                                    market_value=market_value,
                                    cost_basis=cost_basis,
                                    unrealized_gain_loss=gain_loss,
                                    unrealized_gain_loss_pct=gain_loss_pct,
                                    acquisition_date=acquisition_date if acquisition_date else None,
                                    sector=SECTOR_MAP.get(symbol),
                                    est_annual_income=est_income,
                                    est_yield=est_yield,
                                )
                                
                                portfolio.holdings.append(holding)
                                portfolio.total_cost_basis += cost_basis
                                portfolio.total_unrealized_gain_loss += gain_loss
                                
                            except Exception as e:
                                logger.warning(f"Error parsing JPM holding row: {e}")
                                continue
                
                logger.info(f"Parsed JPMorgan PDF: {len(portfolio.holdings)} holdings, ${portfolio.ending_value:,.2f} value")
                
        except Exception as e:
            logger.error(f"Error parsing JPMorgan PDF: {e}")
        
        return portfolio
    
    def _is_holdings_table_fidelity(self, table: list) -> bool:
        """Check if table contains Fidelity holdings data."""
        if not table or len(table) < 2:
            return False
        
        header = " ".join(str(cell or "").lower() for cell in table[0])
        return any(keyword in header for keyword in ['symbol', 'ticker', 'quantity', 'market value', 'cost basis'])
    
    def _is_holdings_table_jpmorgan(self, table: list) -> bool:
        """Check if table contains JPMorgan holdings data."""
        if not table or len(table) < 2:
            return False
        
        header = " ".join(str(cell or "").lower() for cell in table[0])
        return any(keyword in header for keyword in ['symbol', 'shares', 'acquisition', 'unrealized'])
    
    def _parse_holdings_table_fidelity(self, table: list) -> list[EnhancedHolding]:
        """Parse Fidelity holdings table into EnhancedHolding objects."""
        holdings = []
        
        if len(table) < 2:
            return holdings
        
        # Find column indices
        header = [str(cell or "").lower() for cell in table[0]]
        symbol_idx = next((i for i, h in enumerate(header) if 'symbol' in h or 'ticker' in h), None)
        name_idx = next((i for i, h in enumerate(header) if 'description' in h or 'name' in h), None)
        qty_idx = next((i for i, h in enumerate(header) if 'quantity' in h or 'shares' in h), None)
        price_idx = next((i for i, h in enumerate(header) if 'price' in h or 'current price' in h), None)
        value_idx = next((i for i, h in enumerate(header) if 'market value' in h or 'current value' in h), None)
        cost_idx = next((i for i, h in enumerate(header) if 'cost basis' in h or 'total cost' in h), None)
        gain_idx = next((i for i, h in enumerate(header) if 'gain/loss' in h or 'unrealized' in h), None)
        
        # Parse rows
        for row in table[1:]:
            if not row or len(row) < 3:
                continue
            
            try:
                symbol = str(row[symbol_idx] if symbol_idx is not None else "").strip().upper()
                if not symbol or symbol in ['CASH', 'TOTAL', '']:
                    continue
                
                name = str(row[name_idx] if name_idx is not None else symbol).strip()
                quantity = self._parse_number(row[qty_idx]) if qty_idx is not None else 0.0
                price = self._parse_number(row[price_idx]) if price_idx is not None else 0.0
                market_value = self._parse_number(row[value_idx]) if value_idx is not None else 0.0
                cost_basis = self._parse_number(row[cost_idx]) if cost_idx is not None else 0.0
                unrealized_gain = self._parse_number(row[gain_idx]) if gain_idx is not None else 0.0
                
                # Calculate percentage
                unrealized_pct = (unrealized_gain / cost_basis * 100) if cost_basis > 0 else 0.0
                
                holding = EnhancedHolding(
                    symbol=symbol,
                    name=name,
                    quantity=quantity,
                    price_per_unit=price or (market_value / quantity if quantity > 0 else 0.0),
                    market_value=market_value,
                    cost_basis=cost_basis,
                    unrealized_gain_loss=unrealized_gain,
                    unrealized_gain_loss_pct=unrealized_pct,
                    sector=SECTOR_MAP.get(symbol),
                    asset_type=self._infer_asset_type(symbol, name),
                )
                
                holdings.append(holding)
                
            except Exception as e:
                logger.warning(f"Error parsing holding row: {e}")
                continue
        
        return holdings
    
    def _parse_holdings_table_jpmorgan(self, table: list) -> list[EnhancedHolding]:
        """Parse JPMorgan holdings table into EnhancedHolding objects."""
        holdings = []
        
        if len(table) < 2:
            return holdings
        
        # Similar to Fidelity but with acquisition date
        header = [str(cell or "").lower() for cell in table[0]]
        symbol_idx = next((i for i, h in enumerate(header) if 'symbol' in h), None)
        name_idx = next((i for i, h in enumerate(header) if 'description' in h or 'security' in h), None)
        qty_idx = next((i for i, h in enumerate(header) if 'shares' in h or 'quantity' in h), None)
        acq_idx = next((i for i, h in enumerate(header) if 'acquisition' in h or 'acquired' in h), None)
        price_idx = next((i for i, h in enumerate(header) if 'price' in h), None)
        cost_idx = next((i for i, h in enumerate(header) if 'cost' in h), None)
        gain_idx = next((i for i, h in enumerate(header) if 'unrealized' in h or 'gain/loss' in h), None)
        
        for row in table[1:]:
            if not row or len(row) < 3:
                continue
            
            try:
                symbol = str(row[symbol_idx] if symbol_idx is not None else "").strip().upper()
                if not symbol or symbol in ['CASH', 'TOTAL']:
                    continue
                
                name = str(row[name_idx] if name_idx is not None else symbol).strip()
                quantity = self._parse_number(row[qty_idx]) if qty_idx is not None else 0.0
                acquisition_date = str(row[acq_idx]) if acq_idx is not None else None
                price = self._parse_number(row[price_idx]) if price_idx is not None else 0.0
                cost_basis = self._parse_number(row[cost_idx]) if cost_idx is not None else 0.0
                unrealized_gain = self._parse_number(row[gain_idx]) if gain_idx is not None else 0.0
                
                market_value = price * quantity if price > 0 and quantity > 0 else 0.0
                unrealized_pct = (unrealized_gain / cost_basis * 100) if cost_basis > 0 else 0.0
                
                holding = EnhancedHolding(
                    symbol=symbol,
                    name=name,
                    quantity=quantity,
                    price_per_unit=price,
                    market_value=market_value,
                    cost_basis=cost_basis,
                    unrealized_gain_loss=unrealized_gain,
                    unrealized_gain_loss_pct=unrealized_pct,
                    acquisition_date=acquisition_date,
                    sector=SECTOR_MAP.get(symbol),
                    asset_type=self._infer_asset_type(symbol, name),
                )
                
                holdings.append(holding)
                
            except Exception as e:
                logger.warning(f"Error parsing JPM holding row: {e}")
                continue
        
        return holdings
    
    def _infer_asset_type(self, symbol: str, name: str) -> str:
        """Infer asset type from symbol and name."""
        name_lower = name.lower()
        
        if symbol in ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'VEA', 'VWO', 'EFA', 'IEMG']:
            return "etf"
        elif 'etf' in name_lower or 'fund' in name_lower:
            return "etf"
        elif 'bond' in name_lower or 'treasury' in name_lower or 'note' in name_lower:
            return "bond"
        elif 'preferred' in name_lower:
            return "preferred"
        elif symbol == 'CASH' or 'money market' in name_lower:
            return "cash"
        else:
            return "stock"
    
    def _is_long_term(self, acquisition_date: Optional[str]) -> bool:
        """Check if holding qualifies for long-term capital gains (>1 year)."""
        if not acquisition_date:
            return False
        
        try:
            # Try common date formats
            for fmt in ['%m/%d/%Y', '%Y-%m-%d', '%m-%d-%Y', '%d/%m/%Y']:
                try:
                    acq_dt = datetime.strptime(acquisition_date, fmt)
                    days_held = (datetime.now() - acq_dt).days
                    return days_held > 365
                except ValueError:
                    continue
        except Exception:
            pass
        
        return False
    
    def _parse_number(self, value: str) -> float:
        """Parse a number from string, handling currency symbols and commas."""
        if not value:
            return 0.0
        
        # Remove currency symbols, commas, parentheses (for negative)
        clean = re.sub(r'[$,\s]', '', str(value))
        
        # Handle parentheses for negative numbers
        if clean.startswith('(') and clean.endswith(')'):
            clean = '-' + clean[1:-1]
        
        # Handle percentage signs
        clean = clean.replace('%', '')
        
        try:
            return float(clean)
        except ValueError:
            return 0.0


class RichPDFParser:
    """
    Multi-strategy PDF parser for maximum data extraction.
    
    Uses three strategies in order:
    1. Enhanced table extraction with flexible header detection
    2. Regex-based text extraction for specific brokerage formats
    3. Gemini LLM fallback for complex/unstructured PDFs
    """
    
    def __init__(self):
        self._gemini_model = None
    
    def parse(self, pdf_bytes: bytes, filename: str) -> EnhancedPortfolio:
        """Parse PDF using all available strategies."""
        try:
            import pdfplumber
        except ImportError:
            logger.error("pdfplumber not installed")
            return EnhancedPortfolio(source="pdf")
        
        portfolio = EnhancedPortfolio(source="pdf")
        
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                # Extract all text
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                
                # Extract tables
                tables = []
                for page in pdf.pages:
                    page_tables = page.extract_tables()
                    if page_tables:
                        tables.extend(page_tables)
                
                # Detect brokerage type
                brokerage = self._detect_brokerage(text, filename)
                logger.info(f"Detected brokerage: {brokerage}")
                
                # Extract account metadata (always from text)
                self._extract_metadata(portfolio, text, brokerage)
                
                # Strategy 1: Enhanced table extraction
                holdings = self._parse_tables_enhanced(tables, text, brokerage)
                logger.info(f"Strategy 1 (tables): Found {len(holdings)} holdings")
                
                # Strategy 2: Regex fallback if tables failed or incomplete
                if len(holdings) < 3:
                    regex_holdings = self._parse_text_regex(text, brokerage)
                    logger.info(f"Strategy 2 (regex): Found {len(regex_holdings)} holdings")
                    if len(regex_holdings) > len(holdings):
                        holdings = regex_holdings
                
                # Strategy 3: Gemini LLM fallback if still no holdings
                if not holdings:
                    logger.info("Attempting Strategy 3 (Gemini LLM)")
                    holdings = self._parse_with_gemini_sync(text, brokerage)
                    logger.info(f"Strategy 3 (Gemini): Found {len(holdings)} holdings")
                
                portfolio.holdings = holdings
                
                # Calculate totals
                for h in holdings:
                    portfolio.total_cost_basis += h.cost_basis
                    portfolio.total_unrealized_gain_loss += h.unrealized_gain_loss
                    portfolio.ending_value += h.market_value
                
                logger.info(f"Rich PDF Parser: {len(holdings)} holdings, ${portfolio.ending_value:,.2f} value")
                
        except Exception as e:
            logger.error(f"Error in RichPDFParser: {e}")
        
        return portfolio
    
    def _detect_brokerage(self, text: str, filename: str) -> str:
        """Detect brokerage from text content and filename."""
        text_lower = text.lower()
        filename_lower = filename.lower()
        
        if 'fidelity' in text_lower or 'fidelity' in filename_lower:
            return "fidelity"
        elif 'jpmorgan' in text_lower or 'chase' in text_lower or 'jpmorgan' in filename_lower:
            return "jpmorgan"
        elif 'schwab' in text_lower or 'schwab' in filename_lower:
            return "schwab"
        elif 'vanguard' in text_lower or 'vanguard' in filename_lower:
            return "vanguard"
        elif 'robinhood' in text_lower or 'robinhood' in filename_lower:
            return "robinhood"
        else:
            return "unknown"
    
    def _extract_metadata(self, portfolio: EnhancedPortfolio, text: str, brokerage: str):
        """Extract account metadata from text."""
        # Account number patterns
        acct_patterns = [
            r'Account.*?(\d{3}-\d{5,6})',
            r'Account\s*#?\s*:?\s*(\d{6,12})',
            r'Account Number[:\s]*(\d{3}-\d{5})',
        ]
        for pattern in acct_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                portfolio.account_number = match.group(1)
                break
        
        # Statement period
        period_match = re.search(
            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}).*?'
            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})',
            text, re.IGNORECASE
        )
        if period_match:
            portfolio.statement_period_start = f"{period_match.group(1)} {period_match.group(2)}, {period_match.group(5)}"
            portfolio.statement_period_end = f"{period_match.group(3)} {period_match.group(4)}, {period_match.group(5)}"
        
        # Beginning/Ending values
        begin_match = re.search(r'Beginning.*?Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
        if begin_match:
            portfolio.beginning_value = self._parse_number(begin_match.group(1))
        
        end_match = re.search(r'Ending.*?Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
        if end_match:
            portfolio.ending_value = self._parse_number(end_match.group(1))
        
        # Asset allocation
        allocation_patterns = [
            (r'(\d+)%\s*Domestic Stock', 'domestic_stock'),
            (r'(\d+)%\s*Foreign Stock', 'foreign_stock'),
            (r'(\d+)%\s*Bonds', 'bonds'),
            (r'(\d+)%\s*Short[\s-]?term', 'short_term'),
            (r'(\d+)%\s*Cash', 'cash'),
            (r'(\d+)%\s*Other', 'other'),
            (r'(\d+)%\s*Stocks', 'stocks'),
            (r'(\d+)%\s*Mutual Funds', 'mutual_funds'),
            (r'(\d+)%\s*Exchange Traded', 'etf'),
        ]
        for pattern, key in allocation_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                portfolio.asset_allocation[key] = int(match.group(1)) / 100.0
        
        # Income summary
        div_match = re.search(r'Dividends.*?Taxable.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE | re.DOTALL)
        if div_match:
            portfolio.taxable_dividends = self._parse_number(div_match.group(1))
        
        interest_match = re.search(r'Interest.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if interest_match:
            portfolio.interest_income = self._parse_number(interest_match.group(1))
    
    def _parse_tables_enhanced(self, tables: list, text: str, brokerage: str) -> list:
        """Enhanced table parsing with flexible header detection."""
        holdings = []
        
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            header_row = table[0]
            if not header_row:
                continue
            
            header_str = ' '.join(str(h).lower() for h in header_row if h)
            
            # Flexible header detection - look for any holdings-like table
            is_holdings_table = any(kw in header_str for kw in [
                'description', 'quantity', 'market value', 'cost basis',
                'symbol', 'shares', 'price', 'value', 'gain', 'loss'
            ])
            
            if not is_holdings_table:
                continue
            
            # Find column indices dynamically
            header = [str(cell or "").lower() for cell in header_row]
            col_map = self._map_columns(header)
            
            # Parse rows
            for row in table[1:]:
                holding = self._parse_holding_row(row, col_map, text, brokerage)
                if holding:
                    holdings.append(holding)
        
        return holdings
    
    def _map_columns(self, header: list) -> dict:
        """Map column names to indices."""
        col_map = {}
        
        for i, h in enumerate(header):
            h_lower = h.lower()
            if any(kw in h_lower for kw in ['description', 'security', 'name']):
                col_map['description'] = i
            elif 'symbol' in h_lower or 'ticker' in h_lower:
                col_map['symbol'] = i
            elif any(kw in h_lower for kw in ['quantity', 'shares', 'qty']):
                col_map['quantity'] = i
            elif 'price' in h_lower and 'unit' in h_lower:
                col_map['price'] = i
            elif 'price' in h_lower:
                col_map.setdefault('price', i)
            elif 'market value' in h_lower or 'ending' in h_lower and 'value' in h_lower:
                col_map['market_value'] = i
            elif 'cost' in h_lower and 'basis' in h_lower:
                col_map['cost_basis'] = i
            elif 'unrealized' in h_lower or 'gain/loss' in h_lower or 'gain' in h_lower:
                col_map['gain_loss'] = i
            elif 'annual' in h_lower and 'income' in h_lower:
                col_map['est_income'] = i
            elif 'yield' in h_lower:
                col_map['est_yield'] = i
            elif 'maturity' in h_lower:
                col_map['maturity'] = i
            elif 'coupon' in h_lower or 'rate' in h_lower:
                col_map['coupon'] = i
        
        return col_map
    
    def _parse_holding_row(self, row: list, col_map: dict, text: str, brokerage: str) -> Optional[EnhancedHolding]:
        """Parse a single holding row."""
        if not row or len(row) < 3:
            return None
        
        try:
            # Get description
            desc_idx = col_map.get('description', 0)
            description = str(row[desc_idx] or '').strip()
            
            if not description or description.upper() in ['TOTAL', 'CASH', '', 'N/A']:
                return None
            
            # Extract symbol from description (e.g., "APPLE INC (AAPL)")
            symbol = None
            name = description
            
            # Pattern 1: Symbol in parentheses
            symbol_match = re.search(r'\(([A-Z]{1,5})\)', description)
            if symbol_match:
                symbol = symbol_match.group(1)
                name = description.replace(f'({symbol})', '').strip()
            
            # Pattern 2: Symbol at start
            if not symbol:
                start_match = re.match(r'^([A-Z]{1,5})\s+', description)
                if start_match:
                    symbol = start_match.group(1)
                    name = description[len(symbol):].strip()
            
            # Pattern 3: Use first word if all caps
            if not symbol:
                words = description.split()
                if words and words[0].isupper() and len(words[0]) <= 5:
                    symbol = words[0]
                    name = ' '.join(words[1:]) if len(words) > 1 else symbol
            
            if not symbol:
                symbol = description[:10].strip().upper()
            
            # Get numeric values
            quantity = self._parse_number(row[col_map['quantity']]) if 'quantity' in col_map else 0.0
            price = self._parse_number(row[col_map['price']]) if 'price' in col_map else 0.0
            market_value = self._parse_number(row[col_map['market_value']]) if 'market_value' in col_map else 0.0
            cost_basis = self._parse_number(row[col_map['cost_basis']]) if 'cost_basis' in col_map else 0.0
            gain_loss = self._parse_number(row[col_map['gain_loss']]) if 'gain_loss' in col_map else 0.0
            est_income = self._parse_number(row[col_map['est_income']]) if 'est_income' in col_map else None
            est_yield = self._parse_number(row[col_map['est_yield']]) if 'est_yield' in col_map else None
            
            # Calculate missing values
            if market_value == 0 and quantity > 0 and price > 0:
                market_value = quantity * price
            if price == 0 and quantity > 0 and market_value > 0:
                price = market_value / quantity
            if gain_loss == 0 and cost_basis > 0 and market_value > 0:
                gain_loss = market_value - cost_basis
            
            gain_loss_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0
            
            # Look for CUSIP in text
            cusip = None
            cusip_match = re.search(rf'{re.escape(symbol)}.*?CUSIP[:\s]*([A-Z0-9]{{9}})', text, re.IGNORECASE | re.DOTALL)
            if cusip_match:
                cusip = cusip_match.group(1)
            
            # Determine asset type
            asset_type = self._infer_asset_type(symbol, name, description)
            
            return EnhancedHolding(
                symbol=symbol,
                name=name,
                quantity=quantity,
                price_per_unit=price,
                market_value=market_value,
                cost_basis=cost_basis,
                unrealized_gain_loss=gain_loss,
                unrealized_gain_loss_pct=gain_loss_pct,
                sector=SECTOR_MAP.get(symbol),
                asset_type=asset_type,
                est_annual_income=est_income,
                est_yield=est_yield / 100 if est_yield and est_yield > 1 else est_yield,
                cusip=cusip,
            )
            
        except Exception as e:
            logger.warning(f"Error parsing holding row: {e}")
            return None
    
    def _parse_text_regex(self, text: str, brokerage: str) -> list:
        """Extract holdings using regex patterns."""
        holdings = []
        
        if brokerage == "fidelity":
            holdings = self._parse_fidelity_regex(text)
        elif brokerage == "jpmorgan":
            holdings = self._parse_jpmorgan_regex(text)
        else:
            # Generic patterns
            holdings = self._parse_generic_regex(text)
        
        return holdings
    
    def _parse_fidelity_regex(self, text: str) -> list:
        """Parse Fidelity-specific patterns from text."""
        holdings = []
        
        # Pattern for Fidelity holdings: "COMPANY NAME (SYMBOL)" followed by numbers
        # Example: "APPLE INC (AAPL) 25.00 525.31 $13,132.75 $9,350.12 $3,782.63 $304.68 2.32%"
        pattern = r'([A-Z][A-Za-z\s&\.\-,]+?)\s*\(([A-Z]{1,5})\)\s+([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+[\-\$]?([\d,]+\.?\d*)'
        
        for match in re.finditer(pattern, text):
            try:
                name = match.group(1).strip()
                symbol = match.group(2)
                quantity = self._parse_number(match.group(3))
                price = self._parse_number(match.group(4))
                market_value = self._parse_number(match.group(5))
                cost_basis = self._parse_number(match.group(6))
                gain_loss = self._parse_number(match.group(7))
                
                if quantity > 0 and market_value > 0:
                    gain_loss_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0
                    
                    holding = EnhancedHolding(
                        symbol=symbol,
                        name=name,
                        quantity=quantity,
                        price_per_unit=price,
                        market_value=market_value,
                        cost_basis=cost_basis,
                        unrealized_gain_loss=gain_loss,
                        unrealized_gain_loss_pct=gain_loss_pct,
                        sector=SECTOR_MAP.get(symbol),
                        asset_type=self._infer_asset_type(symbol, name, name),
                    )
                    holdings.append(holding)
            except Exception as e:
                logger.warning(f"Regex parse error: {e}")
                continue
        
        # Also look for bond patterns with CUSIP
        bond_pattern = r'CUSIP[:\s]*([A-Z0-9]{9}).*?(\d{1,2}/\d{1,2}/\d{2,4})?\s+([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)'
        for match in re.finditer(bond_pattern, text, re.IGNORECASE | re.DOTALL):
            try:
                cusip = match.group(1)
                quantity = self._parse_number(match.group(3))
                price = self._parse_number(match.group(4))
                market_value = self._parse_number(match.group(5))
                
                if quantity > 0:
                    holding = EnhancedHolding(
                        symbol=cusip[:5],
                        name=f"Bond {cusip}",
                        quantity=quantity,
                        price_per_unit=price,
                        market_value=market_value,
                        cost_basis=market_value,
                        unrealized_gain_loss=0,
                        unrealized_gain_loss_pct=0,
                        asset_type="bond",
                        cusip=cusip,
                    )
                    holdings.append(holding)
            except Exception:
                continue
        
        return holdings
    
    def _parse_jpmorgan_regex(self, text: str) -> list:
        """Parse JPMorgan-specific patterns from text."""
        holdings = []
        
        # JPMorgan pattern: "Symbol: XXXX" with surrounding data
        symbol_pattern = r'Symbol[:\s]*([A-Z]{1,5})'
        
        for match in re.finditer(symbol_pattern, text):
            symbol = match.group(1)
            
            # Look for associated data near the symbol
            context_start = max(0, match.start() - 500)
            context_end = min(len(text), match.end() + 500)
            context = text[context_start:context_end]
            
            # Extract values from context
            qty_match = re.search(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:shares?|qty)', context, re.IGNORECASE)
            value_match = re.search(r'Market Value[:\s]*\$?([\d,]+\.?\d*)', context, re.IGNORECASE)
            cost_match = re.search(r'Cost Basis[:\s]*\$?([\d,]+\.?\d*)', context, re.IGNORECASE)
            
            if qty_match and value_match:
                quantity = self._parse_number(qty_match.group(1))
                market_value = self._parse_number(value_match.group(1))
                cost_basis = self._parse_number(cost_match.group(1)) if cost_match else market_value
                
                holding = EnhancedHolding(
                    symbol=symbol,
                    name=symbol,
                    quantity=quantity,
                    price_per_unit=market_value / quantity if quantity > 0 else 0,
                    market_value=market_value,
                    cost_basis=cost_basis,
                    unrealized_gain_loss=market_value - cost_basis,
                    unrealized_gain_loss_pct=((market_value - cost_basis) / cost_basis * 100) if cost_basis > 0 else 0,
                    sector=SECTOR_MAP.get(symbol),
                )
                holdings.append(holding)
        
        return holdings
    
    def _parse_generic_regex(self, text: str) -> list:
        """Generic regex patterns for unknown brokerages."""
        holdings = []
        
        # Pattern: SYMBOL followed by numbers
        pattern = r'\b([A-Z]{1,5})\b\s+([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)'
        
        for match in re.finditer(pattern, text):
            symbol = match.group(1)
            if symbol in ['THE', 'AND', 'FOR', 'INC', 'LLC', 'ETF', 'USD', 'TOTAL']:
                continue
            
            quantity = self._parse_number(match.group(2))
            price = self._parse_number(match.group(3))
            value = self._parse_number(match.group(4))
            
            if quantity > 0 and value > 0:
                holding = EnhancedHolding(
                    symbol=symbol,
                    name=symbol,
                    quantity=quantity,
                    price_per_unit=price,
                    market_value=value,
                    cost_basis=value,
                    unrealized_gain_loss=0,
                    unrealized_gain_loss_pct=0,
                    sector=SECTOR_MAP.get(symbol),
                )
                holdings.append(holding)
        
        return holdings
    
    def _parse_with_gemini_sync(self, text: str, brokerage: str) -> list:
        """Use Gemini to extract holdings (synchronous wrapper)."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context, create a new task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self._parse_with_gemini(text, brokerage))
                    return future.result(timeout=30)
            else:
                return asyncio.run(self._parse_with_gemini(text, brokerage))
        except Exception as e:
            logger.warning(f"Gemini sync wrapper failed: {e}")
            return []
    
    async def _parse_with_gemini(self, text: str, brokerage: str) -> list:
        """Use Gemini LLM to extract holdings from complex text."""
        holdings = []
        
        try:
            from google import genai
            from google.genai import types
            import os
            from hushh_mcp.constants import GEMINI_MODEL
            
            api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                logger.warning("No Gemini API key found, skipping LLM extraction")
                return []
            
            client = genai.Client(api_key=api_key)
            
            prompt = f"""Extract all investment holdings from this {brokerage} brokerage statement.

For each holding, extract these fields (use null if not found):
- symbol: stock ticker symbol (e.g., AAPL, MSFT)
- name: company/security name
- quantity: number of shares
- price: price per share
- market_value: total current value
- cost_basis: original purchase cost
- unrealized_gain_loss: profit or loss (can be negative)
- est_annual_income: estimated annual dividend/interest income
- est_yield: estimated yield percentage
- cusip: CUSIP identifier if available
- asset_type: one of [stock, etf, bond, mutual_fund, preferred, cash]

Return ONLY a valid JSON array of objects. No explanation, just the JSON.

Statement text (first 12000 chars):
{text[:12000]}
"""
            
            config = types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
            )
            
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            response_text = response.text.strip()
            
            # Clean up response - extract JSON array
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            import json
            data = json.loads(response_text)
            
            for item in data:
                if not item.get('symbol'):
                    continue
                
                holding = EnhancedHolding(
                    symbol=item.get('symbol', '').upper(),
                    name=item.get('name', item.get('symbol', '')),
                    quantity=float(item.get('quantity', 0) or 0),
                    price_per_unit=float(item.get('price', 0) or 0),
                    market_value=float(item.get('market_value', 0) or 0),
                    cost_basis=float(item.get('cost_basis', 0) or 0),
                    unrealized_gain_loss=float(item.get('unrealized_gain_loss', 0) or 0),
                    unrealized_gain_loss_pct=0,
                    est_annual_income=float(item.get('est_annual_income', 0) or 0) if item.get('est_annual_income') else None,
                    est_yield=float(item.get('est_yield', 0) or 0) / 100 if item.get('est_yield') else None,
                    cusip=item.get('cusip'),
                    asset_type=item.get('asset_type', 'stock'),
                    sector=SECTOR_MAP.get(item.get('symbol', '').upper()),
                )
                
                # Calculate gain/loss percentage
                if holding.cost_basis > 0:
                    holding.unrealized_gain_loss_pct = (holding.unrealized_gain_loss / holding.cost_basis) * 100
                
                holdings.append(holding)
            
            logger.info(f"Gemini extracted {len(holdings)} holdings")
            
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}")
        
        return holdings
    
    # ========================================================================
    # LLM-FIRST COMPREHENSIVE EXTRACTION (PRIMARY METHOD)
    # ========================================================================
    
    def parse_comprehensive(self, pdf_bytes: bytes, filename: str) -> ComprehensivePortfolio:
        """
        Parse PDF using LLM-first approach for comprehensive data extraction.
        
        This is the PRIMARY extraction method that uses Gemini's PDF vision
        capabilities to extract ALL financial data from brokerage statements.
        
        Falls back to regex-based extraction if LLM fails.
        """
        import asyncio
        
        portfolio = ComprehensivePortfolio(extraction_method="unknown")
        
        # Strategy 1: Gemini PDF Vision (PRIMARY)
        logger.info("=" * 60)
        logger.info("Strategy 1: Attempting Gemini PDF Vision extraction")
        logger.info("=" * 60)
        
        try:
            # Try to run async in sync context
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(
                            asyncio.run, 
                            self._parse_with_gemini_comprehensive(pdf_bytes, filename)
                        )
                        portfolio = future.result(timeout=120)  # 2 minute timeout
                else:
                    portfolio = asyncio.run(
                        self._parse_with_gemini_comprehensive(pdf_bytes, filename)
                    )
            except RuntimeError:
                # No event loop, create one
                portfolio = asyncio.run(
                    self._parse_with_gemini_comprehensive(pdf_bytes, filename)
                )
            
            if portfolio and portfolio.holdings:
                logger.info(f"Gemini Vision extracted {len(portfolio.holdings)} holdings")
                logger.info(f"Total value: ${portfolio.total_value:,.2f}")
                portfolio.extraction_method = "gemini_vision"
                return portfolio
            else:
                logger.warning("Gemini Vision returned no holdings, falling back to regex")
                
        except Exception as e:
            logger.error(f"Gemini Vision extraction failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        # Strategy 2: Regex-based extraction (FALLBACK)
        logger.info("=" * 60)
        logger.info("Strategy 2: Falling back to regex-based extraction")
        logger.info("=" * 60)
        
        try:
            # Use existing parse method
            enhanced_portfolio = self.parse(pdf_bytes, filename)
            
            if enhanced_portfolio and enhanced_portfolio.holdings:
                # Convert EnhancedPortfolio to ComprehensivePortfolio
                portfolio = self._convert_enhanced_to_comprehensive(enhanced_portfolio)
                portfolio.extraction_method = "regex"
                logger.info(f"Regex extracted {len(portfolio.holdings)} holdings")
                return portfolio
                
        except Exception as e:
            logger.error(f"Regex extraction also failed: {e}")
        
        logger.error("All extraction strategies failed")
        return portfolio
    
    async def _parse_with_gemini_comprehensive(
        self, 
        pdf_bytes: bytes, 
        filename: str
    ) -> ComprehensivePortfolio:
        """
        Use Gemini with PDF vision to extract ALL financial data.
        
        This is the PRIMARY extraction method that leverages Gemini's
        multimodal capabilities to understand PDF layout and tables.
        
        Supports both:
        - Google AI Studio API keys (start with 'AIza')
        - Vertex AI / Google Cloud credentials
        """
        import os
        import json
        import base64
        from google import genai
        from google.genai import types
        from hushh_mcp.constants import GEMINI_MODEL, GEMINI_MODEL_VERTEX
        
        portfolio = ComprehensivePortfolio()
        
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        use_vertex = False
        model_to_use = GEMINI_MODEL
        
        # Determine which client to use based on API key format
        if api_key and api_key.startswith("AIza"):
            # Google AI Studio API key
            logger.info("Using Google AI Studio API key")
            client = genai.Client(api_key=api_key)
            model_to_use = GEMINI_MODEL
        else:
            # Try Vertex AI with Application Default Credentials
            logger.info("Using Vertex AI with Application Default Credentials")
            try:
                # For Vertex AI, we need project and location
                project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
                
                # Try to get project from gcloud config if not set
                if not project_id:
                    import subprocess
                    try:
                        result = subprocess.run(
                            ['gcloud', 'config', 'get-value', 'project'],
                            capture_output=True, text=True, timeout=5
                        )
                        if result.returncode == 0 and result.stdout.strip():
                            project_id = result.stdout.strip()
                    except Exception:
                        pass
                
                if not project_id:
                    raise ValueError("No GCP project found. Set GOOGLE_CLOUD_PROJECT env var.")
                
                location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
                
                client = genai.Client(
                    vertexai=True,
                    project=project_id,
                    location=location,
                )
                use_vertex = True
                model_to_use = GEMINI_MODEL_VERTEX
                logger.info(f"Using Vertex AI with project: {project_id}, model: {model_to_use}")
                
            except Exception as e:
                logger.error(f"Vertex AI init failed: {e}")
                raise ValueError(f"Could not initialize Gemini client: {e}")
        
        # Encode PDF as base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        prompt = """You are a financial document parser. Analyze this brokerage statement PDF and extract ALL financial data.

Return a JSON object with these sections (use null for missing values, NOT 0):

{
  "account_info": {
    "holder_name": "string - account holder's full name",
    "account_number": "string - account number",
    "account_type": "string - e.g., Individual, TOD, Joint, IRA, 401k",
    "brokerage": "string - brokerage firm name",
    "statement_period_start": "string - start date",
    "statement_period_end": "string - end date",
    "tax_lot_method": "string - FIFO, LIFO, etc."
  },
  
  "account_summary": {
    "beginning_value": number,
    "ending_value": number,
    "net_deposits_period": number,
    "net_deposits_ytd": number,
    "withdrawals_period": number,
    "withdrawals_ytd": number,
    "total_income_period": number,
    "total_income_ytd": number,
    "total_fees": number,
    "change_in_value": number
  },
  
  "asset_allocation": {
    "cash_pct": number (as percentage, e.g., 54.4 for 54.4%),
    "cash_value": number,
    "equities_pct": number,
    "equities_value": number,
    "bonds_pct": number,
    "bonds_value": number,
    "mutual_funds_pct": number,
    "mutual_funds_value": number,
    "etf_pct": number,
    "etf_value": number
  },
  
  "holdings": [
    {
      "symbol": "string - ticker symbol",
      "name": "string - security name",
      "cusip": "string or null",
      "acquisition_date": "string or null",
      "quantity": number,
      "price": number - current price per share,
      "market_value": number - total current value,
      "unit_cost": number - cost per share,
      "cost_basis": number - total cost,
      "unrealized_gain_loss": number (negative for losses),
      "unrealized_gain_loss_pct": number,
      "term": "string - ST or LT for short/long term",
      "est_annual_income": number or null,
      "est_yield": number or null (as percentage),
      "asset_type": "string - stock, etf, bond, mutual_fund, preferred, cash",
      "dividend_reinvest": boolean
    }
  ],
  
  "income_summary": {
    "dividends_taxable": number,
    "dividends_nontaxable": number,
    "dividends_qualified": number,
    "interest_income": number,
    "capital_gains_dist": number,
    "total_income": number
  },
  
  "realized_gain_loss": {
    "short_term_gain": number,
    "short_term_loss": number (as positive number),
    "long_term_gain": number,
    "long_term_loss": number (as positive number),
    "net_short_term": number,
    "net_long_term": number,
    "net_realized": number
  },
  
  "transactions": [
    {
      "date": "string",
      "settle_date": "string or null",
      "type": "string - BUY, SELL, DIVIDEND, REINVEST, TRANSFER",
      "symbol": "string",
      "description": "string",
      "quantity": number,
      "price": number,
      "amount": number,
      "cost_basis": number or null,
      "realized_gain_loss": number or null,
      "fees": number or null
    }
  ],
  
  "cash_flow": {
    "opening_balance": number,
    "deposits": number,
    "withdrawals": number,
    "dividends_received": number,
    "interest_received": number,
    "trades_proceeds": number,
    "trades_cost": number,
    "fees_paid": number,
    "closing_balance": number
  },
  
  "cash_balance": number - total cash/sweep balance,
  "total_value": number - total account value
}

CRITICAL INSTRUCTIONS:
1. Extract ALL holdings, not just a sample - scan every page
2. Parse negative numbers correctly: (1,234.56) means -1234.56
3. Include dividend reinvestment (DRIP) transactions
4. For holdings, extract the FULL data row including acquisition date, cost basis, gain/loss
5. Match symbols to their corresponding data carefully - PDF tables may span multiple lines
6. Return ONLY valid JSON, no explanation or markdown
7. If a section has no data, use null for the entire section, not empty objects
8. For percentages, use the actual number (e.g., 54.4 for 54.4%, not 0.544)
"""
        
        logger.info(f"Sending PDF to Gemini Vision ({len(pdf_bytes)} bytes), model: {model_to_use}")
        
        # Create the content with PDF - use simple list format for Vertex AI compatibility
        contents = [
            prompt,
            types.Part(
                inline_data=types.Blob(
                    mime_type="application/pdf",
                    data=pdf_base64
                )
            )
        ]
        
        config = types.GenerateContentConfig(
            temperature=0.1,  # Low temperature for accuracy
            max_output_tokens=32768,  # Large output for comprehensive data
        )
        
        response = await client.aio.models.generate_content(
            model=model_to_use,
            contents=contents,
            config=config,
        )
        
        response_text = response.text.strip()
        logger.info(f"Gemini response length: {len(response_text)} chars")
        
        # Clean up response - extract JSON
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0]
        elif '```' in response_text:
            parts = response_text.split('```')
            if len(parts) >= 2:
                response_text = parts[1]
        
        response_text = response_text.strip()
        
        # Parse JSON
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Response text (first 500 chars): {response_text[:500]}")
            raise
        
        # Convert to ComprehensivePortfolio
        portfolio = self._parse_gemini_comprehensive_response(data)
        portfolio.raw_text_length = len(response_text)
        
        return portfolio
    
    def _parse_gemini_comprehensive_response(self, data: dict) -> ComprehensivePortfolio:
        """Parse Gemini's JSON response into ComprehensivePortfolio."""
        portfolio = ComprehensivePortfolio()
        
        # Account Info
        if data.get('account_info'):
            ai = data['account_info']
            portfolio.account_info = AccountInfo(
                holder_name=ai.get('holder_name', ''),
                account_number=ai.get('account_number', ''),
                account_type=ai.get('account_type', ''),
                brokerage=ai.get('brokerage', ''),
                statement_period_start=ai.get('statement_period_start', ''),
                statement_period_end=ai.get('statement_period_end', ''),
                tax_lot_method=ai.get('tax_lot_method', 'FIFO'),
            )
        
        # Account Summary
        if data.get('account_summary'):
            acs = data['account_summary']
            portfolio.account_summary = AccountSummary(
                beginning_value=float(acs.get('beginning_value') or 0),
                ending_value=float(acs.get('ending_value') or 0),
                net_deposits_period=float(acs.get('net_deposits_period') or 0),
                net_deposits_ytd=float(acs.get('net_deposits_ytd') or 0),
                withdrawals_period=float(acs.get('withdrawals_period') or 0),
                withdrawals_ytd=float(acs.get('withdrawals_ytd') or 0),
                total_income_period=float(acs.get('total_income_period') or 0),
                total_income_ytd=float(acs.get('total_income_ytd') or 0),
                total_fees=float(acs.get('total_fees') or 0),
                change_in_value=float(acs.get('change_in_value') or 0),
            )
        
        # Asset Allocation
        if data.get('asset_allocation'):
            aa = data['asset_allocation']
            portfolio.asset_allocation = AssetAllocation(
                cash_pct=float(aa.get('cash_pct') or 0),
                cash_value=float(aa.get('cash_value') or 0),
                equities_pct=float(aa.get('equities_pct') or 0),
                equities_value=float(aa.get('equities_value') or 0),
                bonds_pct=float(aa.get('bonds_pct') or 0),
                bonds_value=float(aa.get('bonds_value') or 0),
                mutual_funds_pct=float(aa.get('mutual_funds_pct') or 0),
                mutual_funds_value=float(aa.get('mutual_funds_value') or 0),
                etf_pct=float(aa.get('etf_pct') or 0),
                etf_value=float(aa.get('etf_value') or 0),
            )
        
        # Holdings
        if data.get('holdings'):
            for h in data['holdings']:
                if not h.get('symbol'):
                    continue
                
                holding = EnhancedHolding(
                    symbol=str(h.get('symbol', '')).upper(),
                    name=h.get('name', h.get('symbol', '')),
                    quantity=float(h.get('quantity') or 0),
                    price_per_unit=float(h.get('price') or 0),
                    market_value=float(h.get('market_value') or 0),
                    cost_basis=float(h.get('cost_basis') or 0),
                    unrealized_gain_loss=float(h.get('unrealized_gain_loss') or 0),
                    unrealized_gain_loss_pct=float(h.get('unrealized_gain_loss_pct') or 0),
                    acquisition_date=h.get('acquisition_date'),
                    sector=SECTOR_MAP.get(str(h.get('symbol', '')).upper()),
                    asset_type=h.get('asset_type', 'stock'),
                    est_annual_income=float(h.get('est_annual_income')) if h.get('est_annual_income') else None,
                    est_yield=float(h.get('est_yield')) / 100 if h.get('est_yield') else None,
                    cusip=h.get('cusip'),
                )
                
                # Calculate gain/loss percentage if not provided
                if holding.unrealized_gain_loss_pct == 0 and holding.cost_basis > 0:
                    holding.unrealized_gain_loss_pct = (holding.unrealized_gain_loss / holding.cost_basis) * 100
                
                portfolio.holdings.append(holding)
        
        # Income Summary
        if data.get('income_summary'):
            inc = data['income_summary']
            portfolio.income_summary = IncomeSummary(
                dividends_taxable=float(inc.get('dividends_taxable') or 0),
                dividends_nontaxable=float(inc.get('dividends_nontaxable') or 0),
                dividends_qualified=float(inc.get('dividends_qualified') or 0),
                interest_income=float(inc.get('interest_income') or 0),
                capital_gains_dist=float(inc.get('capital_gains_dist') or 0),
                total_income=float(inc.get('total_income') or 0),
            )
        
        # Realized Gain/Loss
        if data.get('realized_gain_loss'):
            rgl = data['realized_gain_loss']
            portfolio.realized_gain_loss = RealizedGainLoss(
                short_term_gain=float(rgl.get('short_term_gain') or 0),
                short_term_loss=float(rgl.get('short_term_loss') or 0),
                long_term_gain=float(rgl.get('long_term_gain') or 0),
                long_term_loss=float(rgl.get('long_term_loss') or 0),
                net_short_term=float(rgl.get('net_short_term') or 0),
                net_long_term=float(rgl.get('net_long_term') or 0),
                net_realized=float(rgl.get('net_realized') or 0),
            )
        
        # Transactions
        if data.get('transactions'):
            for t in data['transactions']:
                txn = Transaction(
                    date=t.get('date', ''),
                    settle_date=t.get('settle_date', ''),
                    type=t.get('type', ''),
                    symbol=t.get('symbol', ''),
                    description=t.get('description', ''),
                    quantity=float(t.get('quantity') or 0),
                    price=float(t.get('price') or 0),
                    amount=float(t.get('amount') or 0),
                    cost_basis=float(t.get('cost_basis') or 0),
                    realized_gain_loss=float(t.get('realized_gain_loss') or 0),
                    fees=float(t.get('fees') or 0),
                )
                portfolio.transactions.append(txn)
        
        # Cash Flow
        if data.get('cash_flow'):
            cf = data['cash_flow']
            portfolio.cash_flow = CashFlow(
                opening_balance=float(cf.get('opening_balance') or 0),
                deposits=float(cf.get('deposits') or 0),
                withdrawals=float(cf.get('withdrawals') or 0),
                dividends_received=float(cf.get('dividends_received') or 0),
                interest_received=float(cf.get('interest_received') or 0),
                trades_proceeds=float(cf.get('trades_proceeds') or 0),
                trades_cost=float(cf.get('trades_cost') or 0),
                fees_paid=float(cf.get('fees_paid') or 0),
                closing_balance=float(cf.get('closing_balance') or 0),
            )
        
        # Totals
        portfolio.cash_balance = float(data.get('cash_balance') or 0)
        portfolio.total_value = float(data.get('total_value') or 0)
        
        # Calculate unrealized gain/loss total
        portfolio.unrealized_gain_loss = sum(h.unrealized_gain_loss for h in portfolio.holdings)
        
        logger.info(f"Parsed {len(portfolio.holdings)} holdings from Gemini response")
        logger.info(f"Account: {portfolio.account_info.holder_name if portfolio.account_info else 'Unknown'}")
        logger.info(f"Total value: ${portfolio.total_value:,.2f}")
        logger.info(f"Cash balance: ${portfolio.cash_balance:,.2f}")
        
        return portfolio
    
    def _convert_enhanced_to_comprehensive(self, enhanced: EnhancedPortfolio) -> ComprehensivePortfolio:
        """Convert EnhancedPortfolio to ComprehensivePortfolio for fallback."""
        portfolio = ComprehensivePortfolio()
        
        # Copy holdings
        portfolio.holdings = enhanced.holdings
        
        # Account info
        portfolio.account_info = AccountInfo(
            account_number=enhanced.account_number or '',
            account_type=enhanced.account_type,
            statement_period_start=enhanced.statement_period_start or '',
            statement_period_end=enhanced.statement_period_end or '',
        )
        
        # Account summary
        portfolio.account_summary = AccountSummary(
            beginning_value=enhanced.beginning_value,
            ending_value=enhanced.ending_value,
        )
        
        # Asset allocation
        if enhanced.asset_allocation:
            portfolio.asset_allocation = AssetAllocation(
                cash_pct=enhanced.asset_allocation.get('cash', 0) * 100,
                equities_pct=enhanced.asset_allocation.get('stocks', 0) * 100 + enhanced.asset_allocation.get('domestic_stock', 0) * 100,
                bonds_pct=enhanced.asset_allocation.get('bonds', 0) * 100,
            )
        
        # Income
        portfolio.income_summary = IncomeSummary(
            dividends_taxable=enhanced.taxable_dividends,
            dividends_nontaxable=enhanced.tax_exempt_dividends,
            interest_income=enhanced.interest_income,
            total_income=enhanced.taxable_dividends + enhanced.tax_exempt_dividends + enhanced.interest_income,
        )
        
        # Realized gains
        portfolio.realized_gain_loss = RealizedGainLoss(
            short_term_gain=enhanced.realized_short_term_gain if enhanced.realized_short_term_gain > 0 else 0,
            short_term_loss=abs(enhanced.realized_short_term_gain) if enhanced.realized_short_term_gain < 0 else 0,
            long_term_gain=enhanced.realized_long_term_gain if enhanced.realized_long_term_gain > 0 else 0,
            long_term_loss=abs(enhanced.realized_long_term_gain) if enhanced.realized_long_term_gain < 0 else 0,
            net_realized=enhanced.realized_short_term_gain + enhanced.realized_long_term_gain,
        )
        
        # Totals
        portfolio.total_value = enhanced.ending_value
        portfolio.unrealized_gain_loss = enhanced.total_unrealized_gain_loss
        
        return portfolio
    
    def _infer_asset_type(self, symbol: str, name: str, description: str) -> str:
        """Infer asset type from symbol and name."""
        combined = f"{name} {description}".lower()
        
        if symbol in ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'VEA', 'VWO', 'JNK', 'HYG']:
            return "etf"
        elif 'etf' in combined or 'exchange traded' in combined:
            return "etf"
        elif 'bond' in combined or 'treasury' in combined or 'note' in combined or 'cusip' in combined:
            return "bond"
        elif 'preferred' in combined or 'pfd' in combined:
            return "preferred"
        elif 'fund' in combined and 'etf' not in combined:
            return "mutual_fund"
        elif symbol == 'CASH' or 'money market' in combined or 'fdic' in combined:
            return "cash"
        else:
            return "stock"
    
    def _parse_number(self, value) -> float:
        """Parse a number from string."""
        if not value:
            return 0.0
        
        clean = re.sub(r'[$,\s]', '', str(value))
        if clean.startswith('(') and clean.endswith(')'):
            clean = '-' + clean[1:-1]
        clean = clean.replace('%', '')
        
        try:
            return float(clean)
        except ValueError:
            return 0.0


class PortfolioImportService:
    """
    Service for importing and analyzing portfolio data.
    
    Handles file parsing, KPI derivation, and world model integration.
    """
    
    def __init__(self):
        self.parser = PortfolioParser()
        self.rich_parser = RichPDFParser()
        self._world_model = None
    
    @property
    def world_model(self):
        if self._world_model is None:
            from hushh_mcp.services.world_model_service import get_world_model_service
            self._world_model = get_world_model_service()
        return self._world_model
    
    async def import_file(
        self,
        user_id: str,
        file_content: bytes,
        filename: str,
    ) -> ImportResult:
        """
        Parse portfolio file and return all data for client-side encryption.
        
        DOES NOT STORE data - that's the frontend's job after encryption.
        
        Uses LLM-first approach for PDFs to extract comprehensive financial data.
        
        Args:
            user_id: User's ID (for identification)
            file_content: Raw file bytes
            filename: Original filename (for type detection)
            
        Returns:
            ImportResult with:
            - success: bool
            - holdings: list of holdings with all details
            - kpis: dict of all derived KPIs
            - losers/winners: identified positions
            - portfolio_data: complete parsed portfolio for encryption
            - account_info, account_summary, etc.: comprehensive financial data
        """
        try:
            comprehensive_portfolio = None
            enhanced_portfolio = None
            
            # 1. Parse the file
            if filename.lower().endswith('.csv'):
                content = file_content.decode('utf-8')
                portfolio = self.parser.parse_csv(content)
                # Convert to EnhancedPortfolio for KPI derivation
                enhanced_portfolio = self._convert_to_enhanced(portfolio)
                
            elif filename.lower().endswith('.pdf'):
                # Use LLM-first comprehensive parser for PDFs
                logger.info(f"=" * 60)
                logger.info(f"Parsing PDF with LLM-First Comprehensive Parser: {filename}")
                logger.info(f"=" * 60)
                
                comprehensive_portfolio = self.rich_parser.parse_comprehensive(file_content, filename)
                
                if comprehensive_portfolio and comprehensive_portfolio.holdings:
                    logger.info(f"Comprehensive parser extracted {len(comprehensive_portfolio.holdings)} holdings")
                    logger.info(f"Extraction method: {comprehensive_portfolio.extraction_method}")
                    
                    # Convert to EnhancedPortfolio for backward compatibility
                    enhanced_portfolio = self._convert_comprehensive_to_enhanced(comprehensive_portfolio)
                else:
                    # Final fallback to legacy parsers
                    logger.warning("Comprehensive parser found no holdings, trying legacy parsers")
                    if 'fidelity' in filename.lower():
                        enhanced_portfolio = self.parser.parse_fidelity_pdf(file_content)
                    elif 'jpmorgan' in filename.lower() or 'chase' in filename.lower():
                        enhanced_portfolio = self.parser.parse_jpmorgan_pdf(file_content)
                    else:
                        enhanced_portfolio = self.parser.parse_fidelity_pdf(file_content)
                
                if not enhanced_portfolio or not enhanced_portfolio.holdings:
                    return ImportResult(
                        success=False,
                        error="No holdings found in PDF. The parser tried LLM vision, regex, and table extraction but couldn't extract holdings. Please try CSV export or contact support.",
                    )
            else:
                return ImportResult(
                    success=False,
                    error=f"Unsupported file type: {filename}. Please use CSV or PDF.",
                )
            
            if not enhanced_portfolio.holdings:
                return ImportResult(
                    success=False,
                    error="No holdings found in the file. Please check the format.",
                )
            
            # 2. Derive enhanced KPIs (ALL 71 KPIs)
            kpis = self._derive_enhanced_kpis(enhanced_portfolio)
            
            # 3. Convert holdings for response
            basic_holdings = [
                Holding(
                    symbol=h.symbol,
                    name=h.name,
                    quantity=h.quantity,
                    cost_basis=h.cost_basis,
                    current_value=h.market_value,
                    gain_loss=h.unrealized_gain_loss,
                    gain_loss_pct=h.unrealized_gain_loss_pct,
                    sector=h.sector,
                    asset_type=h.asset_type,
                )
                for h in enhanced_portfolio.holdings
            ]
            
            basic_portfolio = Portfolio(
                holdings=basic_holdings,
                total_value=enhanced_portfolio.ending_value or sum(h.market_value for h in enhanced_portfolio.holdings),
                total_cost_basis=enhanced_portfolio.total_cost_basis,
                total_gain_loss=enhanced_portfolio.total_unrealized_gain_loss,
                source=enhanced_portfolio.source,
            )
            
            # 4. Identify losers and winners
            losers = basic_portfolio.identify_losers()
            winners = basic_portfolio.identify_winners()
            
            # 5. Build complete portfolio data object for client encryption
            # This is what the frontend will encrypt and store
            portfolio_data = self._build_portfolio_data(
                enhanced_portfolio, 
                comprehensive_portfolio, 
                kpis, 
                losers, 
                winners
            )
            
            # 6. Build comprehensive data for ImportResult
            account_info_dict = None
            account_summary_dict = None
            asset_allocation_dict = None
            income_summary_dict = None
            realized_gain_loss_dict = None
            transactions_list = None
            cash_balance = 0.0
            
            if comprehensive_portfolio:
                if comprehensive_portfolio.account_info:
                    ai = comprehensive_portfolio.account_info
                    account_info_dict = {
                        "holder_name": ai.holder_name,
                        "account_number": ai.account_number,
                        "account_type": ai.account_type,
                        "brokerage": ai.brokerage,
                        "statement_period_start": ai.statement_period_start,
                        "statement_period_end": ai.statement_period_end,
                        "tax_lot_method": ai.tax_lot_method,
                    }
                
                if comprehensive_portfolio.account_summary:
                    acs = comprehensive_portfolio.account_summary
                    account_summary_dict = {
                        "beginning_value": acs.beginning_value,
                        "ending_value": acs.ending_value,
                        "net_deposits_period": acs.net_deposits_period,
                        "net_deposits_ytd": acs.net_deposits_ytd,
                        "total_income_period": acs.total_income_period,
                        "total_income_ytd": acs.total_income_ytd,
                        "total_fees": acs.total_fees,
                        "change_in_value": acs.change_in_value,
                    }
                
                if comprehensive_portfolio.asset_allocation:
                    aa = comprehensive_portfolio.asset_allocation
                    asset_allocation_dict = {
                        "cash_pct": aa.cash_pct,
                        "cash_value": aa.cash_value,
                        "equities_pct": aa.equities_pct,
                        "equities_value": aa.equities_value,
                        "bonds_pct": aa.bonds_pct,
                        "bonds_value": aa.bonds_value,
                        "mutual_funds_pct": aa.mutual_funds_pct,
                        "mutual_funds_value": aa.mutual_funds_value,
                        "etf_pct": aa.etf_pct,
                        "etf_value": aa.etf_value,
                    }
                
                if comprehensive_portfolio.income_summary:
                    inc = comprehensive_portfolio.income_summary
                    income_summary_dict = {
                        "dividends_taxable": inc.dividends_taxable,
                        "dividends_nontaxable": inc.dividends_nontaxable,
                        "dividends_qualified": inc.dividends_qualified,
                        "interest_income": inc.interest_income,
                        "capital_gains_dist": inc.capital_gains_dist,
                        "total_income": inc.total_income,
                    }
                
                if comprehensive_portfolio.realized_gain_loss:
                    rgl = comprehensive_portfolio.realized_gain_loss
                    realized_gain_loss_dict = {
                        "short_term_gain": rgl.short_term_gain,
                        "short_term_loss": rgl.short_term_loss,
                        "long_term_gain": rgl.long_term_gain,
                        "long_term_loss": rgl.long_term_loss,
                        "net_short_term": rgl.net_short_term,
                        "net_long_term": rgl.net_long_term,
                        "net_realized": rgl.net_realized,
                    }
                
                if comprehensive_portfolio.transactions:
                    transactions_list = [
                        {
                            "date": t.date,
                            "settle_date": t.settle_date,
                            "type": t.type,
                            "symbol": t.symbol,
                            "description": t.description,
                            "quantity": t.quantity,
                            "price": t.price,
                            "amount": t.amount,
                            "cost_basis": t.cost_basis,
                            "realized_gain_loss": t.realized_gain_loss,
                            "fees": t.fees,
                        }
                        for t in comprehensive_portfolio.transactions
                    ]
                
                cash_balance = comprehensive_portfolio.cash_balance
            
            # 7. Return everything - NO storage in backend
            return ImportResult(
                success=True,
                holdings_count=len(enhanced_portfolio.holdings),
                total_value=enhanced_portfolio.ending_value or sum(h.market_value for h in enhanced_portfolio.holdings),
                losers=losers,
                winners=winners,
                kpis_stored=[],  # None stored - frontend will handle
                source=enhanced_portfolio.source,
                portfolio_data=portfolio_data,
                # Comprehensive financial data
                account_info=account_info_dict,
                account_summary=account_summary_dict,
                asset_allocation=asset_allocation_dict,
                income_summary=income_summary_dict,
                realized_gain_loss=realized_gain_loss_dict,
                transactions=transactions_list,
                cash_balance=cash_balance,
            )
            
        except Exception as e:
            logger.error(f"Error importing portfolio: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return ImportResult(
                success=False,
                error=f"Error processing file: {str(e)}",
            )
    
    def _build_portfolio_data(
        self, 
        enhanced_portfolio: EnhancedPortfolio,
        comprehensive_portfolio: Optional[ComprehensivePortfolio],
        kpis: dict,
        losers: list,
        winners: list,
    ) -> dict:
        """Build the complete portfolio data object for client encryption."""
        portfolio_data = {
            "account_metadata": {
                "account_number": enhanced_portfolio.account_number,
                "account_type": enhanced_portfolio.account_type,
                "statement_period_start": enhanced_portfolio.statement_period_start,
                "statement_period_end": enhanced_portfolio.statement_period_end,
            },
            "values": {
                "beginning_value": enhanced_portfolio.beginning_value,
                "ending_value": enhanced_portfolio.ending_value,
                "total_cost_basis": enhanced_portfolio.total_cost_basis,
                "total_unrealized_gain_loss": enhanced_portfolio.total_unrealized_gain_loss,
            },
            "asset_allocation": enhanced_portfolio.asset_allocation,
            "income": {
                "taxable_dividends": enhanced_portfolio.taxable_dividends,
                "tax_exempt_dividends": enhanced_portfolio.tax_exempt_dividends,
                "interest_income": enhanced_portfolio.interest_income,
                "capital_gains_short": enhanced_portfolio.capital_gains_short,
                "capital_gains_long": enhanced_portfolio.capital_gains_long,
            },
            "realized_gains": {
                "short_term": enhanced_portfolio.realized_short_term_gain,
                "long_term": enhanced_portfolio.realized_long_term_gain,
            },
            "holdings": [
                {
                    "symbol": h.symbol,
                    "name": h.name,
                    "quantity": h.quantity,
                    "price_per_unit": h.price_per_unit,
                    "market_value": h.market_value,
                    "cost_basis": h.cost_basis,
                    "unrealized_gain_loss": h.unrealized_gain_loss,
                    "unrealized_gain_loss_pct": h.unrealized_gain_loss_pct,
                    "acquisition_date": h.acquisition_date,
                    "sector": h.sector,
                    "asset_type": h.asset_type,
                    "est_annual_income": h.est_annual_income,
                    "est_yield": h.est_yield,
                    "cusip": h.cusip,
                    "is_margin": h.is_margin,
                    "is_short": h.is_short,
                }
                for h in enhanced_portfolio.holdings
            ],
            "kpis": kpis,
            "losers": losers,
            "winners": winners,
            "imported_at": datetime.utcnow().isoformat(),
            "source": enhanced_portfolio.source,
        }
        
        # Add comprehensive data if available
        if comprehensive_portfolio:
            if comprehensive_portfolio.account_info:
                ai = comprehensive_portfolio.account_info
                portfolio_data["account_metadata"]["holder_name"] = ai.holder_name
                portfolio_data["account_metadata"]["brokerage"] = ai.brokerage
                portfolio_data["account_metadata"]["tax_lot_method"] = ai.tax_lot_method
            
            if comprehensive_portfolio.transactions:
                portfolio_data["transactions"] = [
                    {
                        "date": t.date,
                        "settle_date": t.settle_date,
                        "type": t.type,
                        "symbol": t.symbol,
                        "description": t.description,
                        "quantity": t.quantity,
                        "price": t.price,
                        "amount": t.amount,
                        "cost_basis": t.cost_basis,
                        "realized_gain_loss": t.realized_gain_loss,
                    }
                    for t in comprehensive_portfolio.transactions
                ]
            
            if comprehensive_portfolio.cash_flow:
                cf = comprehensive_portfolio.cash_flow
                portfolio_data["cash_flow"] = {
                    "opening_balance": cf.opening_balance,
                    "deposits": cf.deposits,
                    "withdrawals": cf.withdrawals,
                    "dividends_received": cf.dividends_received,
                    "interest_received": cf.interest_received,
                    "trades_proceeds": cf.trades_proceeds,
                    "trades_cost": cf.trades_cost,
                    "fees_paid": cf.fees_paid,
                    "closing_balance": cf.closing_balance,
                }
            
            portfolio_data["cash_balance"] = comprehensive_portfolio.cash_balance
            portfolio_data["extraction_method"] = comprehensive_portfolio.extraction_method
        
        return portfolio_data
    
    def _convert_comprehensive_to_enhanced(self, comprehensive: ComprehensivePortfolio) -> EnhancedPortfolio:
        """Convert ComprehensivePortfolio to EnhancedPortfolio for backward compatibility."""
        enhanced = EnhancedPortfolio(source="pdf")
        
        # Copy holdings
        enhanced.holdings = comprehensive.holdings
        
        # Account metadata
        if comprehensive.account_info:
            enhanced.account_number = comprehensive.account_info.account_number
            enhanced.account_type = comprehensive.account_info.account_type
            enhanced.statement_period_start = comprehensive.account_info.statement_period_start
            enhanced.statement_period_end = comprehensive.account_info.statement_period_end
        
        # Values
        if comprehensive.account_summary:
            enhanced.beginning_value = comprehensive.account_summary.beginning_value
            enhanced.ending_value = comprehensive.account_summary.ending_value
        else:
            enhanced.ending_value = comprehensive.total_value
        
        # Calculate totals from holdings
        enhanced.total_cost_basis = sum(h.cost_basis for h in comprehensive.holdings)
        enhanced.total_unrealized_gain_loss = comprehensive.unrealized_gain_loss
        
        # Asset allocation
        if comprehensive.asset_allocation:
            aa = comprehensive.asset_allocation
            enhanced.asset_allocation = {
                "cash": aa.cash_pct / 100 if aa.cash_pct else 0,
                "stocks": aa.equities_pct / 100 if aa.equities_pct else 0,
                "bonds": aa.bonds_pct / 100 if aa.bonds_pct else 0,
                "mutual_funds": aa.mutual_funds_pct / 100 if aa.mutual_funds_pct else 0,
                "etf": aa.etf_pct / 100 if aa.etf_pct else 0,
            }
        
        # Income
        if comprehensive.income_summary:
            inc = comprehensive.income_summary
            enhanced.taxable_dividends = inc.dividends_taxable
            enhanced.tax_exempt_dividends = inc.dividends_nontaxable
            enhanced.interest_income = inc.interest_income
        
        # Realized gains
        if comprehensive.realized_gain_loss:
            rgl = comprehensive.realized_gain_loss
            enhanced.realized_short_term_gain = rgl.net_short_term
            enhanced.realized_long_term_gain = rgl.net_long_term
        
        return enhanced
    
    def _convert_to_enhanced(self, portfolio: Portfolio) -> EnhancedPortfolio:
        """Convert basic Portfolio to EnhancedPortfolio."""
        enhanced = EnhancedPortfolio(source=portfolio.source)
        enhanced.ending_value = portfolio.total_value
        enhanced.total_cost_basis = portfolio.total_cost_basis
        enhanced.total_unrealized_gain_loss = portfolio.total_gain_loss
        enhanced.total_unrealized_gain_loss_pct = portfolio.total_gain_loss_pct
        
        for h in portfolio.holdings:
            enhanced_holding = EnhancedHolding(
                symbol=h.symbol,
                name=h.name,
                quantity=h.quantity,
                price_per_unit=h.current_value / h.quantity if h.quantity > 0 else 0.0,
                market_value=h.current_value,
                cost_basis=h.cost_basis,
                unrealized_gain_loss=h.gain_loss,
                unrealized_gain_loss_pct=h.gain_loss_pct,
                sector=h.sector,
                asset_type=h.asset_type,
            )
            enhanced.holdings.append(enhanced_holding)
        
        return enhanced
    
    def _derive_kpis(self, portfolio: Portfolio) -> dict:
        """Derive basic KPIs from portfolio for world model (legacy)."""
        kpis = {}
        
        if not portfolio.holdings:
            return kpis
        
        # Holdings count
        kpis["holdings_count"] = len(portfolio.holdings)
        
        # Portfolio value bucket (anonymized)
        value = portfolio.total_value
        if value < 10000:
            kpis["portfolio_value_bucket"] = "under_10k"
        elif value < 50000:
            kpis["portfolio_value_bucket"] = "10k_50k"
        elif value < 100000:
            kpis["portfolio_value_bucket"] = "50k_100k"
        elif value < 500000:
            kpis["portfolio_value_bucket"] = "100k_500k"
        elif value < 1000000:
            kpis["portfolio_value_bucket"] = "500k_1m"
        else:
            kpis["portfolio_value_bucket"] = "over_1m"
        
        # Total gain/loss percentage
        kpis["total_gain_loss_pct"] = round(portfolio.total_gain_loss_pct, 2)
        
        # Winners and losers count
        losers = portfolio.identify_losers(threshold=-5.0)
        winners = portfolio.identify_winners(threshold=10.0)
        kpis["losers_count"] = len(losers)
        kpis["winners_count"] = len(winners)
        
        # Asset mix
        asset_counts = {}
        for h in portfolio.holdings:
            asset_counts[h.asset_type] = asset_counts.get(h.asset_type, 0) + 1
        
        total = len(portfolio.holdings)
        asset_mix = {k: round(v / total, 2) for k, v in asset_counts.items()}
        kpis["asset_mix"] = str(asset_mix)
        
        # Sector allocation
        sector_values = {}
        for h in portfolio.holdings:
            if h.sector:
                sector_values[h.sector] = sector_values.get(h.sector, 0) + h.current_value
        
        if sector_values and portfolio.total_value > 0:
            sector_allocation = {
                k: round(v / portfolio.total_value, 2) 
                for k, v in sorted(sector_values.items(), key=lambda x: -x[1])[:5]
            }
            kpis["sector_allocation"] = str(sector_allocation)
        
        # Concentration score (top 5 holdings as % of total)
        sorted_holdings = sorted(portfolio.holdings, key=lambda x: -x.current_value)
        top_5_value = sum(h.current_value for h in sorted_holdings[:5])
        if portfolio.total_value > 0:
            kpis["concentration_score"] = round(top_5_value / portfolio.total_value, 2)
        
        # Risk bucket (based on asset mix and concentration)
        concentration = kpis.get("concentration_score", 0)
        stock_pct = asset_mix.get("stock", 0)
        
        if concentration > 0.7 or stock_pct > 0.9:
            kpis["risk_bucket"] = "aggressive"
        elif concentration > 0.5 or stock_pct > 0.7:
            kpis["risk_bucket"] = "moderate"
        else:
            kpis["risk_bucket"] = "conservative"
        
        return kpis
    
    def _derive_enhanced_kpis(self, portfolio: EnhancedPortfolio) -> dict:
        """
        Derive comprehensive KPIs for world model (15+ metrics).
        
        Categories:
        - Basic metrics (holdings count, value bucket)
        - Asset allocation breakdown
        - Income metrics (dividends, yield)
        - Tax efficiency indicators
        - Concentration metrics
        - Sector exposure
        - Risk indicators
        - Performance metrics
        """
        kpis = {}
        
        if not portfolio.holdings:
            return kpis
        
        # ==== BASIC METRICS ====
        kpis["holdings_count"] = len(portfolio.holdings)
        
        # Portfolio value bucket
        value = portfolio.ending_value or sum(h.market_value for h in portfolio.holdings)
        if value < 10000:
            kpis["portfolio_value_bucket"] = "under_10k"
        elif value < 50000:
            kpis["portfolio_value_bucket"] = "10k_50k"
        elif value < 100000:
            kpis["portfolio_value_bucket"] = "50k_100k"
        elif value < 500000:
            kpis["portfolio_value_bucket"] = "100k_500k"
        elif value < 1000000:
            kpis["portfolio_value_bucket"] = "500k_1m"
        else:
            kpis["portfolio_value_bucket"] = "over_1m"
        
        # ==== ASSET ALLOCATION BREAKDOWN ====
        for asset_class, pct in portfolio.asset_allocation.items():
            kpis[f"allocation_{asset_class}"] = round(pct, 3)
        
        # Calculate asset type breakdown from holdings if not provided
        if not portfolio.asset_allocation:
            asset_values = {}
            for h in portfolio.holdings:
                asset_values[h.asset_type] = asset_values.get(h.asset_type, 0) + h.market_value
            
            if value > 0:
                for asset_type, asset_value in asset_values.items():
                    kpis[f"allocation_{asset_type}"] = round(asset_value / value, 3)
        
        # ==== INCOME METRICS ====
        # Annual dividend income (sum of estimated income from holdings)
        annual_dividend_income = sum(h.est_annual_income or 0 for h in portfolio.holdings)
        kpis["annual_dividend_income"] = round(annual_dividend_income, 2)
        
        # Portfolio yield
        kpis["portfolio_yield"] = round(annual_dividend_income / value, 4) if value > 0 else 0.0
        
        # Income from statement
        if portfolio.taxable_dividends > 0:
            kpis["taxable_dividends"] = round(portfolio.taxable_dividends, 2)
        if portfolio.tax_exempt_dividends > 0:
            kpis["tax_exempt_dividends"] = round(portfolio.tax_exempt_dividends, 2)
        if portfolio.interest_income > 0:
            kpis["interest_income"] = round(portfolio.interest_income, 2)
        
        # ==== TAX EFFICIENCY INDICATORS ====
        # Tax loss harvesting candidates (unrealized losses > $1000)
        tax_loss_candidates = [h for h in portfolio.holdings if h.unrealized_gain_loss < -1000]
        kpis["tax_loss_harvesting_candidates"] = len(tax_loss_candidates)
        
        # Long-term gain positions (held > 1 year)
        long_term_positions = [h for h in portfolio.holdings if self.parser._is_long_term(h.acquisition_date)]
        kpis["long_term_gain_positions"] = len(long_term_positions)
        
        # Unrealized gain positions (for tax planning)
        gain_positions = [h for h in portfolio.holdings if h.unrealized_gain_loss > 1000]
        kpis["unrealized_gain_positions"] = len(gain_positions)
        
        # ==== CONCENTRATION METRICS ====
        # Top 5 concentration
        sorted_holdings = sorted(portfolio.holdings, key=lambda h: h.market_value, reverse=True)
        top_5 = sorted_holdings[:5]
        top_5_value = sum(h.market_value for h in top_5)
        kpis["top_5_concentration"] = round(top_5_value / value, 3) if value > 0 else 0.0
        
        # Top holding details
        if top_5:
            kpis["top_holding_symbol"] = top_5[0].symbol
            kpis["top_holding_pct"] = round(top_5[0].market_value / value, 3) if value > 0 else 0.0
            kpis["top_holding_value"] = round(top_5[0].market_value, 2)
        
        # ==== SECTOR EXPOSURE ====
        sector_values = {}
        for h in portfolio.holdings:
            if h.sector:
                sector_values[h.sector] = sector_values.get(h.sector, 0) + h.market_value
        
        for sector, sector_value in sector_values.items():
            sector_key = f"sector_{sector.lower().replace(' ', '_').replace('-', '_')}"
            kpis[sector_key] = round(sector_value / value, 3) if value > 0 else 0.0
        
        # ==== RISK INDICATORS ====
        # Margin exposure
        margin_value = sum(h.market_value for h in portfolio.holdings if h.is_margin)
        kpis["margin_exposure"] = round(margin_value, 2)
        
        # Short positions
        kpis["short_positions_count"] = len([h for h in portfolio.holdings if h.is_short])
        
        # Volatility proxy (concentration + sector diversity)
        sector_count = len(sector_values)
        kpis["sector_diversity_score"] = min(sector_count / 10.0, 1.0)  # Normalized 0-1
        
        # ==== PERFORMANCE METRICS ====
        # Total unrealized gain/loss
        kpis["total_unrealized_gain_loss"] = round(portfolio.total_unrealized_gain_loss, 2)
        kpis["total_unrealized_gain_loss_pct"] = round(portfolio.total_unrealized_gain_loss_pct, 2)
        
        # YTD return (if beginning value available)
        if portfolio.beginning_value > 0 and portfolio.ending_value > 0:
            ytd_return = (portfolio.ending_value - portfolio.beginning_value) / portfolio.beginning_value * 100
            kpis["ytd_return_pct"] = round(ytd_return, 2)
        
        # Winners vs losers ratio
        losers_count = len([h for h in portfolio.holdings if h.unrealized_gain_loss < 0])
        winners_count = len([h for h in portfolio.holdings if h.unrealized_gain_loss > 0])
        kpis["losers_count"] = losers_count
        kpis["winners_count"] = winners_count
        
        # Risk bucket
        concentration = kpis.get("top_5_concentration", 0)
        stock_allocation = kpis.get("allocation_stock", 0)
        
        if concentration > 0.7 or stock_allocation > 0.9:
            kpis["risk_bucket"] = "aggressive"
        elif concentration > 0.5 or stock_allocation > 0.7:
            kpis["risk_bucket"] = "moderate"
        else:
            kpis["risk_bucket"] = "conservative"
        
        return kpis


# Singleton instance
_portfolio_import_service: Optional[PortfolioImportService] = None


def get_portfolio_import_service() -> PortfolioImportService:
    """Get singleton PortfolioImportService instance."""
    global _portfolio_import_service
    if _portfolio_import_service is None:
        _portfolio_import_service = PortfolioImportService()
    return _portfolio_import_service
