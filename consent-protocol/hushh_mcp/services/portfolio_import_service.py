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
    portfolio_data: Optional[dict] = None  # NEW: Complete parsed data for client encryption


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


class PortfolioImportService:
    """
    Service for importing and analyzing portfolio data.
    
    Handles file parsing, KPI derivation, and world model integration.
    """
    
    def __init__(self):
        self.parser = PortfolioParser()
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
        """
        try:
            # 1. Parse the file
            if filename.lower().endswith('.csv'):
                content = file_content.decode('utf-8')
                portfolio = self.parser.parse_csv(content)
                # Convert to EnhancedPortfolio for KPI derivation
                enhanced_portfolio = self._convert_to_enhanced(portfolio)
            elif filename.lower().endswith('.pdf'):
                # Detect PDF type and parse accordingly
                if 'fidelity' in filename.lower():
                    enhanced_portfolio = self.parser.parse_fidelity_pdf(file_content)
                elif 'jpmorgan' in filename.lower() or 'chase' in filename.lower():
                    enhanced_portfolio = self.parser.parse_jpmorgan_pdf(file_content)
                else:
                    # Try Fidelity parser as default
                    enhanced_portfolio = self.parser.parse_fidelity_pdf(file_content)
                
                if not enhanced_portfolio.holdings:
                    return ImportResult(
                        success=False,
                        error="No holdings found in PDF. Please try CSV export or contact support.",
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
            
            # 6. Return everything - NO storage in backend
            return ImportResult(
                success=True,
                holdings_count=len(enhanced_portfolio.holdings),
                total_value=enhanced_portfolio.ending_value or sum(h.market_value for h in enhanced_portfolio.holdings),
                losers=losers,
                winners=winners,
                kpis_stored=[],  # None stored - frontend will handle
                source=enhanced_portfolio.source,
                portfolio_data=portfolio_data,  # NEW: Full data for client encryption
            )
            
        except Exception as e:
            logger.error(f"Error importing portfolio: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return ImportResult(
                success=False,
                error=f"Error processing file: {str(e)}",
            )
    
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
