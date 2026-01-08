import asyncio
import httpx
import json
import os
from datetime import datetime

# Mimic the SEC fetcher headers
HEADERS = {
    "User-Agent": "Hushh-Research/1.0 (compliance@hushh.ai)",
    "Accept": "application/json"
}

async def dump_sec_data(ticker):
    print(f"[{ticker}] Fetching CIK...")
    async with httpx.AsyncClient() as client:
        # Get ticker-to-CIK mapping
        tickers_response = await client.get(
            "https://www.sec.gov/files/company_tickers.json",
            headers=HEADERS
        )
        tickers_data = tickers_response.json()
        
        cik = None
        for entry in tickers_data.values():
            if entry["ticker"] == ticker.upper():
                cik = str(entry["cik_str"]).zfill(10)
                break
        
        if not cik:
            print(f"[{ticker}] CIK not found.")
            return

        print(f"[{ticker}] CIK: {cik}")
        
        # Get Company Facts
        facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
        print(f"[{ticker}] Fetching facts from {facts_url}...")
        
        facts_response = await client.get(facts_url, headers=HEADERS)
        if facts_response.status_code != 200:
            print(f"[{ticker}] Failed to fetch facts: {facts_response.status_code}")
            return
            
        facts_data = facts_response.json()
        
        # Save to root
        filename = f"sec_payload_{ticker.lower()}.json"
        with open(filename, "w") as f:
            json.dump(facts_data, f, indent=2)
            
        print(f"[{ticker}] Saved payload to {filename}")

async def main():
    await dump_sec_data("AAPL")
    await dump_sec_data("NVDA")

if __name__ == "__main__":
    asyncio.run(main())
