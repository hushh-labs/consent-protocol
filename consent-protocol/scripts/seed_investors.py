#!/usr/bin/env python3
"""
Seed Investor Profiles from Sample JSON

Usage:
    python scripts/seed_investors.py
    python scripts/seed_investors.py --file path/to/custom.json
"""

import argparse
import asyncio
import json
import os
import re
import sys

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
DEFAULT_JSON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "..", "docs", "vision", "kai", "data", "investor_profiles_sample.json"
)


async def seed_investors(json_path: str):
    """Seed investor profiles from JSON file."""
    print(f"📂 Loading data from: {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    investors = data.get("investors", [])
    print(f"📊 Found {len(investors)} investor profiles")

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")

    pool = await asyncpg.create_pool(DATABASE_URL)
    try:
        async with pool.acquire() as conn:
            for inv in investors:
                name = inv.get("name")
                name_normalized = re.sub(r"\s+", "", name.lower()) if name else None
                cik = inv.get("cik")

                # Prepare JSONB fields
                top_holdings = (
                    json.dumps(inv.get("top_holdings"))
                    if inv.get("top_holdings")
                    else None
                )
                sector_exposure = (
                    json.dumps(inv.get("sector_exposure"))
                    if inv.get("sector_exposure")
                    else None
                )
                public_quotes = (
                    json.dumps(inv.get("public_quotes"))
                    if inv.get("public_quotes")
                    else None
                )

                # Upsert by CIK or insert new
                if cik:
                    await conn.execute(
                        """
                        INSERT INTO investor_profiles (
                            name, name_normalized, cik, firm, title, investor_type,
                            aum_billions, top_holdings, sector_exposure,
                            investment_style, risk_tolerance, time_horizon, portfolio_turnover,
                            recent_buys, recent_sells, public_quotes, biography,
                            education, board_memberships, peer_investors,
                            is_insider, insider_company_ticker, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb,
                            $10, $11, $12, $13, $14, $15, $16::jsonb, $17,
                            $18, $19, $20, $21, $22, NOW()
                        )
                        ON CONFLICT (cik) DO UPDATE SET
                            name = EXCLUDED.name,
                            firm = EXCLUDED.firm,
                            title = EXCLUDED.title,
                            aum_billions = EXCLUDED.aum_billions,
                            top_holdings = EXCLUDED.top_holdings,
                            sector_exposure = EXCLUDED.sector_exposure,
                            investment_style = EXCLUDED.investment_style,
                            risk_tolerance = EXCLUDED.risk_tolerance,
                            time_horizon = EXCLUDED.time_horizon,
                            public_quotes = EXCLUDED.public_quotes,
                            biography = EXCLUDED.biography,
                            updated_at = NOW()
                    """,
                        name,
                        name_normalized,
                        cik,
                        inv.get("firm"),
                        inv.get("title"),
                        inv.get("investor_type", "fund_manager"),
                        inv.get("aum_billions"),
                        top_holdings,
                        sector_exposure,
                        inv.get("investment_style"),
                        inv.get("risk_tolerance"),
                        inv.get("time_horizon"),
                        inv.get("portfolio_turnover"),
                        inv.get("recent_buys"),
                        inv.get("recent_sells"),
                        public_quotes,
                        inv.get("biography"),
                        inv.get("education"),
                        inv.get("board_memberships"),
                        inv.get("peer_investors"),
                        inv.get("is_insider", False),
                        inv.get("insider_company_ticker")
                    )
                else:
                    # No CIK - just insert (for insiders)
                    await conn.execute(
                        """
                        INSERT INTO investor_profiles (
                            name, name_normalized, firm, title, investor_type,
                            aum_billions, top_holdings, sector_exposure,
                            investment_style, risk_tolerance, time_horizon, portfolio_turnover,
                            recent_buys, recent_sells, public_quotes, biography,
                            education, board_memberships, peer_investors,
                            is_insider, insider_company_ticker
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
                            $9, $10, $11, $12, $13, $14, $15::jsonb, $16,
                            $17, $18, $19, $20, $21
                        )
                        ON CONFLICT DO NOTHING
                    """,
                        name,
                        name_normalized,
                        inv.get("firm"),
                        inv.get("title"),
                        "tech_insider" if inv.get("is_insider") else "fund_manager",
                        inv.get("aum_billions"),
                        top_holdings,
                        sector_exposure,
                        inv.get("investment_style"),
                        inv.get("risk_tolerance"),
                        inv.get("time_horizon"),
                        inv.get("portfolio_turnover"),
                        inv.get("recent_buys"),
                        inv.get("recent_sells"),
                        public_quotes,
                        inv.get("biography"),
                        inv.get("education"),
                        inv.get("board_memberships"),
                        inv.get("peer_investors"),
                        inv.get("is_insider", False),
                        inv.get("insider_company_ticker")
                    )
                print(f"   ✅ {name}")

            # Get final count
            count = await conn.fetchval("SELECT COUNT(*) FROM investor_profiles")
            print(f"\n📊 Total investor profiles: {count}")

    finally:
        await pool.close()


async def main():
    parser = argparse.ArgumentParser(description="Seed investor profiles from JSON")
    parser.add_argument("--file", default=DEFAULT_JSON, help="Path to JSON file")
    args = parser.parse_args()
    
    await seed_investors(args.file)
    print("\n✅ Seeding complete!")


if __name__ == "__main__":
    asyncio.run(main())
