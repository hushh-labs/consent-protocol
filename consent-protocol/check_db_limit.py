from sqlalchemy import create_engine, text
import json

DATABASE_URL = "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"

def check_db_status():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Check count
        count_res = conn.execute(text("SELECT count(*) FROM investor_profiles")).fetchone()
        print(f"Total rows in investor_profiles: {count_res[0]}")

        # Sample data to see style
        print("\n--- Sample Data (Top 3) ---")
        rows = conn.execute(text("SELECT name, firm, aum_billions, top_holdings, investment_style FROM investor_profiles ORDER BY aum_billions DESC NULLS LAST LIMIT 3"))
        for row in rows:
            print(f"Name: {row[0]}")
            print(f"Firm: {row[1]}")
            print(f"AUM: {row[2]}B")
            print(f"Holdings: {row[3]}")
            print(f"Style: {row[4]}")
            print("-" * 30)

if __name__ == "__main__":
    check_db_status()
