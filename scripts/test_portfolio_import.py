#!/usr/bin/env python3
"""
Test script for Portfolio Import Agent.

Usage:
    python test_portfolio_import.py <path_to_pdf_or_csv>

Example:
    python test_portfolio_import.py data/sample-fidelity-statement.pdf
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hushh_mcp.agents.portfolio_import import get_portfolio_import_agent


async def test_import(file_path: str):
    """Test portfolio import with a file."""
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return
    
    # Read file
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    filename = os.path.basename(file_path)
    
    print(f"\n{'='*60}")
    print(f"Testing Portfolio Import Agent")
    print(f"File: {filename}")
    print(f"Size: {len(file_content):,} bytes")
    print(f"{'='*60}\n")
    
    # Get agent
    agent = get_portfolio_import_agent()
    
    # Import document (using dummy user_id and consent_token for testing)
    result = await agent.import_document(
        user_id="test_user",
        consent_token="test_token",
        file_content=file_content,
        filename=filename,
    )
    
    # Print results
    print(f"Success: {result.success}")
    print(f"Source: {result.source}")
    print(f"Holdings Count: {result.holdings_count}")
    print(f"Total Value: ${result.total_value:,.2f}")
    
    if result.error:
        print(f"Error: {result.error}")
    
    if result.winners:
        print(f"\nTop Winners:")
        for w in result.winners[:5]:
            print(f"  {w['symbol']}: +{w['gain_loss_pct']:.1f}% (${w['gain_loss']:,.2f})")
    
    if result.losers:
        print(f"\nTop Losers:")
        for l in result.losers[:5]:
            print(f"  {l['symbol']}: {l['gain_loss_pct']:.1f}% (${l['gain_loss']:,.2f})")
    
    if result.kpis_stored:
        print(f"\nKPIs Stored: {len(result.kpis_stored)}")
        for kpi in result.kpis_stored[:10]:
            print(f"  - {kpi}")
    
    if result.portfolio_data:
        holdings = result.portfolio_data.get('holdings', [])
        if holdings:
            print(f"\nSample Holdings (first 5):")
            for h in holdings[:5]:
                print(f"  {h['symbol']}: {h['quantity']} shares @ ${h['price_per_unit']:.2f} = ${h['market_value']:,.2f}")
    
    print(f"\n{'='*60}")
    print("Test Complete")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_portfolio_import.py <path_to_file>")
        print("\nSupported formats: CSV, PDF, PNG, JPG, WEBP")
        sys.exit(1)
    
    file_path = sys.argv[1]
    asyncio.run(test_import(file_path))
