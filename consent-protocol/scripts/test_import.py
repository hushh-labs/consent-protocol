
try:
    print("Test 1: Importing yfinance...")
    import yfinance as yf
    print("✅ yfinance imported.")
except ImportError as e:
    print(f"❌ yfinance MISSING: {e}")
    exit(1)

try:
    print("Test 2: Importing models...")
    from hushh_mcp.agents.fundamental.models import MarketMetrics
    print("✅ models imported.")

    print("Test 3: Importing tools...")
    from hushh_mcp.agents.fundamental.tools import MarketFetcher
    print("✅ tools imported.")
    
    print("Test 4: Importing agent...")
    from hushh_mcp.agents.fundamental.agent import FundamentalAgent
    print("✅ agent imported.")
    
except Exception as e:
    print(f"❌ Import Error: {e}")
    import traceback
    traceback.print_exc()
