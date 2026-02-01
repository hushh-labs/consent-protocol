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
        
        Extracts:
        - Account summary (beginning/ending values)
        - Asset allocation percentages
        - Holdings with full details
        - Income metrics (dividends, interest)
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
                
                # Parse account summary
                summary_match = re.search(r'Beginning Portfolio Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if summary_match:
                    portfolio.beginning_value = self._parse_number(summary_match.group(1))
                
                ending_match = re.search(r'Ending Portfolio Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if ending_match:
                    portfolio.ending_value = self._parse_number(ending_match.group(1))
                
                # Parse asset allocation
                allocation_patterns = [
                    (r'(\d+)%\s*Domestic Stock', 'domestic_stock'),
                    (r'(\d+)%\s*Foreign Stock', 'foreign_stock'),
                    (r'(\d+)%\s*Bonds', 'bonds'),
                    (r'(\d+)%\s*Short[\s-]?term', 'short_term'),
                    (r'(\d+)%\s*Cash', 'cash'),
                ]
                for pattern, key in allocation_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        portfolio.asset_allocation[key] = int(match.group(1)) / 100.0
                
                # Parse income
                div_match = re.search(r'Taxable Dividends.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if div_match:
                    portfolio.taxable_dividends = self._parse_number(div_match.group(1))
                
                tax_exempt_match = re.search(r'Tax[\s-]?Exempt.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if tax_exempt_match:
                    portfolio.tax_exempt_dividends = self._parse_number(tax_exempt_match.group(1))
                
                # Parse holdings from tables
                for table in tables:
                    if self._is_holdings_table_fidelity(table):
                        holdings = self._parse_holdings_table_fidelity(table)
                        portfolio.holdings.extend(holdings)
                
                # Calculate derived metrics
                if portfolio.holdings:
                    portfolio.total_cost_basis = sum(h.cost_basis for h in portfolio.holdings)
                    portfolio.total_unrealized_gain_loss = sum(h.unrealized_gain_loss for h in portfolio.holdings)
                    if portfolio.total_cost_basis > 0:
                        portfolio.total_unrealized_gain_loss_pct = (
                            portfolio.total_unrealized_gain_loss / portfolio.total_cost_basis * 100
                        )
                
        except Exception as e:
            logger.error(f"Error parsing Fidelity PDF: {e}")
        
        return portfolio
    
    def parse_jpmorgan_pdf(self, pdf_bytes: bytes) -> EnhancedPortfolio:
        """
        Parse JPMorgan/Chase PDF statement using pdfplumber.
        
        Extracts:
        - Account value (beginning/ending)
        - Asset allocation (equities/cash percentages)
        - Holdings with acquisition dates
        - Income (dividends, interest)
        - Realized gains/losses
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
                
                # Parse account values
                begin_match = re.search(r'Beginning.*?Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if begin_match:
                    portfolio.beginning_value = self._parse_number(begin_match.group(1))
                
                end_match = re.search(r'Ending.*?Value.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if end_match:
                    portfolio.ending_value = self._parse_number(end_match.group(1))
                
                # Parse asset allocation (JPM typically shows Equities vs Cash)
                equity_match = re.search(r'Equities.*?(\d+\.?\d*)%', text, re.IGNORECASE)
                if equity_match:
                    portfolio.asset_allocation['equities'] = float(equity_match.group(1)) / 100.0
                
                cash_match = re.search(r'Cash.*?(\d+\.?\d*)%', text, re.IGNORECASE)
                if cash_match:
                    portfolio.asset_allocation['cash'] = float(cash_match.group(1)) / 100.0
                
                # Parse income
                div_match = re.search(r'Dividends.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if div_match:
                    portfolio.taxable_dividends = self._parse_number(div_match.group(1))
                
                int_match = re.search(r'Interest.*?\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
                if int_match:
                    portfolio.interest_income = self._parse_number(int_match.group(1))
                
                # Parse realized gains
                st_gain_match = re.search(r'Short[\s-]?Term.*?(?:Gain|Loss).*?\$?([\d,\-\(\)]+\.?\d*)', text, re.IGNORECASE)
                if st_gain_match:
                    portfolio.realized_short_term_gain = self._parse_number(st_gain_match.group(1))
                
                # Parse holdings
                for table in tables:
                    if self._is_holdings_table_jpmorgan(table):
                        holdings = self._parse_holdings_table_jpmorgan(table)
                        portfolio.holdings.extend(holdings)
                
                # Calculate derived metrics
                if portfolio.holdings:
                    portfolio.total_cost_basis = sum(h.cost_basis for h in portfolio.holdings)
                    portfolio.total_unrealized_gain_loss = sum(h.unrealized_gain_loss for h in portfolio.holdings)
                    if portfolio.total_cost_basis > 0:
                        portfolio.total_unrealized_gain_loss_pct = (
                            portfolio.total_unrealized_gain_loss / portfolio.total_cost_basis * 100
                        )
                
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
        Import a portfolio file and store KPIs in world model.
        
        Args:
            user_id: User's ID
            file_content: Raw file bytes
            filename: Original filename (for type detection)
            
        Returns:
            ImportResult with holdings count, losers, and stored KPIs
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
            
            # 2. Derive enhanced KPIs
            kpis = self._derive_enhanced_kpis(enhanced_portfolio)
            
            # 3. Store KPIs in world model
            stored_kpis = []
            for key, value in kpis.items():
                success, scope = await self.world_model.store_attribute(
                    user_id=user_id,
                    domain="financial",
                    attribute_key=key,
                    ciphertext=str(value),  # Would be encrypted in production
                    iv="placeholder",
                    tag="placeholder",
                    source="imported",
                )
                if success:
                    stored_kpis.append(key)
            
            # 4. Store portfolio summary
            await self.world_model.store_attribute(
                user_id=user_id,
                domain="financial",
                attribute_key="portfolio_imported",
                ciphertext="true",
                iv="placeholder",
                tag="placeholder",
                source="imported",
            )
            
            # 5. Convert holdings for response
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
                total_gain_loss_pct=enhanced_portfolio.total_unrealized_gain_loss_pct,
                source=enhanced_portfolio.source,
            )
            
            # 6. Return result
            return ImportResult(
                success=True,
                holdings_count=len(enhanced_portfolio.holdings),
                total_value=round(basic_portfolio.total_value, 2),
                losers=basic_portfolio.identify_losers(threshold=-5.0),
                winners=basic_portfolio.identify_winners(threshold=10.0),
                kpis_stored=stored_kpis,
                source=enhanced_portfolio.source,
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
