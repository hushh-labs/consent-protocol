from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"

def check_types():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'investor_profiles'"))
        for row in result:
            print(f"{row[0]}: {row[1]}")

if __name__ == "__main__":
    check_types()
