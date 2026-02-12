#!/usr/bin/env python3
"""
Test SEC Company Facts API to see what financial data is available.
"""

import asyncio

import httpx


async def test_company_facts():
    """Test SEC Company Facts API for AAPL."""
    
    cik = "0000320193"  # Apple
    EDGAR_DATA_URL = "https://data.sec.gov"
    HEADERS = {
        "User-Agent": "Hushh-Research/1.0 (compliance@hushh.ai)",
        "Accept": "application/json"
    }
    
    print(f"🔍 Testing SEC Company Facts API for CIK {cik}...")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient() as client:
            print(f"\nFetching: {EDGAR_DATA_URL}/api/xbrl/companyfacts/CIK{cik}.json")
            response = await client.get(
                f"{EDGAR_DATA_URL}/api/xbrl/companyfacts/CIK{cik}.json",
                headers=HEADERS,
                timeout=15.0
            )
            print(f"Status: {response.status_code}")
            response.raise_for_status()
            
            data = response.json()
            
            # Show structure
            print("\n📊 Available Data Structure:")
            print(f"Entity Name: {data.get('entityName')}")
            print(f"CIK: {data.get('cik')}")
            
            # Check what facts are available
            facts = data.get('facts', {})
            print(f"\nAvailable Taxonomies: {list(facts.keys())}")
            
            # Look at US-GAAP facts (most common)
            us_gaap = facts.get('us-gaap', {})
            print(f"\nUS-GAAP Facts Available: {len(us_gaap)} metrics")
            
            # Key metrics we want
            key_metrics = [
                'Revenues',
                'NetIncomeLoss',
                'Assets',
                'Liabilities',
                'StockholdersEquity',
                'OperatingIncomeLoss',
                'CashAndCashEquivalentsAtCarryingValue'
            ]
            
            print("\n📈 Key Financial Metrics:")
            for metric in key_metrics:
                if metric in us_gaap:
                    metric_data = us_gaap[metric]
                    units = metric_data.get('units', {})
                    # Get USD data
                    usd_data = units.get('USD', [])
                    if usd_data:
                        # Get most recent annual (10-K) value
                        annual_data = [d for d in usd_data if d.get('form') == '10-K']
                        if annual_data:
                            latest = sorted(annual_data, key=lambda x: x.get('end', ''), reverse=True)[0]
                            print(f"\n  {metric}:")
                            print(f"    Value: ${latest['val']:,}")
                            print(f"    Period: {latest.get('start', 'N/A')} to {latest.get('end', 'N/A')}")
                            print(f"    Filed: {latest.get('filed', 'N/A')}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_company_facts())
