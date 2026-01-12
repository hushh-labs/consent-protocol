from sqlalchemy import create_engine, text
import json

DATABASE_URL = "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"

def check_data():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name, top_holdings, investment_style, aum_billions FROM investor_profiles WHERE name_normalized = 'kushal trivedi'"))
        for row in result:
            print(f"Name: {row[0]}")
            print(f"Top Holdings ({type(row[1])}): {row[1]}")
            print(f"Investment Style ({type(row[2])}): {row[2]}")
            print(f"AUM ({type(row[3])}): {row[3]}")

if __name__ == "__main__":
    check_data()
