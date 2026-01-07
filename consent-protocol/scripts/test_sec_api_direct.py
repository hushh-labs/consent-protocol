#!/usr/bin/env python3
"""
Test SEC EDGAR API integration directly with corrected endpoints.
"""

import asyncio
import httpx
from datetime import datetime

async def test_sec_api_direct():
    """Test SEC API calls directly without agent orchestrator."""
    
    ticker = "AAPL"
    EDGAR_DATA_URL = "https://data.sec.gov"
    EDGAR_WWW_URL = "https://www.sec.gov"
    HEADERS = {
        "User-Agent": "Hushh-Research/1.0 (compliance@hushh.ai)",
        "Accept": "application/json"
    }
    
    print(f"🔍 Testing SEC EDGAR API for {ticker}...")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get CIK from ticker
            print("\n1️⃣ Fetching ticker-to-CIK mapping...")
            print(f"   URL: {EDGAR_WWW_URL}/files/company_tickers.json")
            tickers_response = await client.get(
                f"{EDGAR_WWW_URL}/files/company_tickers.json",
                headers=HEADERS,
                timeout=10.0
            )
            print(f"   Status: {tickers_response.status_code}")
            tickers_response.raise_for_status()
            tickers_data = tickers_response.json()
            
            # Find CIK for ticker
            cik = None
            for entry in tickers_data.values():
                if entry.get("ticker", "").upper() == ticker.upper():
                    cik = str(entry["cik_str"]).zfill(10)
                    print(f"   ✅ Found CIK: {cik}")
                    break
            
            if not cik:
                print(f"   ❌ CIK not found for {ticker}")
                return
            
            # Step 2: Get submissions
            print(f"\n2️⃣ Fetching submissions for CIK {cik}...")
            print(f"   URL: {EDGAR_DATA_URL}/submissions/CIK{cik}.json")
            submissions_response = await client.get(
                f"{EDGAR_DATA_URL}/submissions/CIK{cik}.json",
                headers=HEADERS,
                timeout=10.0
            )
            print(f"   Status: {submissions_response.status_code}")
            submissions_response.raise_for_status()
            submissions = submissions_response.json()
            
            # Step 3: Find latest 10-K
            print("\n3️⃣ Looking for latest 10-K filing...")
            filings = submissions.get("filings", {}).get("recent", {})
            forms = filings.get("form", [])
            accession_numbers = filings.get("accessionNumber", [])
            filing_dates = filings.get("filingDate", [])
            
            print(f"   Total recent filings: {len(forms)}")
            
            latest_10k_idx = None
            for i, form in enumerate(forms):
                if form == "10-K":
                    latest_10k_idx = i
                    break
            
            if latest_10k_idx is None:
                print(f"   ❌ No 10-K found")
                return
            
            print(f"   ✅ Found 10-K at index {latest_10k_idx}")
            print(f"   Accession Number: {accession_numbers[latest_10k_idx]}")
            print(f"   Filing Date: {filing_dates[latest_10k_idx]}")
            
            # Show result
            print("\n" + "=" * 60)
            print("✅ SUCCESS - SEC API is working!")
            print(f"Source: SEC EDGAR (Real API)")
            print(f"Fetched at: {datetime.utcnow().isoformat()}")
            
    except httpx.HTTPError as e:
        print(f"\n❌ HTTP Error: {e}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_sec_api_direct())
