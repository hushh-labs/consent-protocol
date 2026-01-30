
try:
    print("Test 1: Importing yfinance...")
    import yfinance as yf  # noqa: F401
    print("✅ yfinance imported.")
except ImportError as e:
    print(f"❌ yfinance MISSING: {e}")
    exit(1)

try:
    print("Test 2: Importing models...")
    print("✅ models imported.")

    print("Test 3: Importing tools...")
    print("✅ tools imported.")
    
    print("Test 4: Importing agent...")
    print("✅ agent imported.")
    
except Exception as e:
    print(f"❌ Import Error: {e}")
    import traceback
    traceback.print_exc()
