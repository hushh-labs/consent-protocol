import os
import json
import logging
from datetime import datetime
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Boolean, JSON, TIMESTAMP, text
from sqlalchemy.orm import sessionmaker

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"

def get_engine():
    try:
        engine = create_engine(DATABASE_URL)
        logger.info("Database engine created successfully.")
        return engine
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        return None

def create_mock_profiles():
    engine = get_engine()
    if not engine:
        return

    metadata = MetaData()
    
    # Reflect the existing table from the database to ensure we match the schema
    try:
        investor_profiles = Table('investor_profiles', metadata, autoload_with=engine)
        logger.info("Successfully reflected 'investor_profiles' table.")
        logger.info(f"Table columns: {[c.name for c in investor_profiles.columns]}")
    except Exception as e:
        logger.error(f"Error reflecting table: {e}")
        # Fallback definition if reflection fails (based on typical schema, adjust if needed)
        investor_profiles = Table(
            'investor_profiles', metadata,
            Column('id', Integer, primary_key=True),
            Column('name', String),
            Column('firm', String),
            Column('role', String),
            Column('risk_tolerance', String),
            Column('investment_style', JSON),
            Column('average_check_size', String),
            Column('sectors', JSON),
            Column('bio', String),
            Column('linkedin_url', String),
            Column('website_url', String),
            Column('created_at', TIMESTAMP),
            Column('updated_at', TIMESTAMP)
        )

    Session = sessionmaker(bind=engine)
    session = Session()

    # Mock Data for Kushal Trivedi
    kushal = {
        "name": "Kushal Trivedi",
        "name_normalized": "kushal trivedi",
        "firm": "Self-Managed", 
        "title": "Individual Investor",
        "investor_type": "Angel",
        "risk_tolerance": "Aggressive",
        "investment_style": ["Growth", "Tech", "Early Stage"],
        "top_holdings": [
            {"ticker": "NVDA", "weight": 15.0},
            {"ticker": "MSFT", "weight": 12.0},
            {"ticker": "GOOGL", "weight": 10.0}
        ],
        "sector_exposure": {"Technology": 60, "Healthcare": 20, "Finance": 20},
        "aum_billions": 0.005, # Mock value
        "biography": "Tech enthusiast and early-stage investor with a focus on AI and automation.",
        "photo_url": "https://media.licdn.com/dms/image/v2/D5603AQH1M-J6Xy_eQA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1718216355608?e=1741824000&v=beta&t=H-O0qOzhC3yTKtQdDrXUeD2HqgwZty0FkDqGysGXXUE", # Placeholder
        "is_insider": False,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    # Mock Data for Manish Sainani
    manish = {
        "name": "Manish Sainani",
        "name_normalized": "manish sainani",
        "firm": "Hushh.ai",
        "title": "Founder",
        "investor_type": "Strategic",
        "risk_tolerance": "Balanced",
        "investment_style": ["Deep Tech", "Data Privacy", "Infrastructure"],
        "top_holdings": [
             {"ticker": "AAPL", "weight": 20.0},
             {"ticker": "AMZN", "weight": 15.0}
        ],
        "sector_exposure": {"Technology": 70, "Consumer": 30},
        "aum_billions": 0.01, # Mock value
        "biography": "Founder of Hushh.ai, building the future of personal data sovereignty.",
        "photo_url": "", 
        "is_insider": True,
        "insider_company_ticker": "HSH", # Mock ticker
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    # Mock Data for Ankit Kumar Singh
    ankit = {
        "name": "Ankit Kumar Singh",
        "name_normalized": "ankit kumar singh",
        "firm": "Independent",
        "title": "Private Investor",
        "investor_type": "Angel",
        "risk_tolerance": "Balanced",
        "investment_style": ["Consumer Tech", "SaaS", "Fintech"],
        "top_holdings": [
             {"ticker": "TSLA", "weight": 10.0},
             {"ticker": "SQ", "weight": 8.0}
        ],
        "sector_exposure": {"Technology": 50, "Finance": 50},
        "aum_billions": 0.002, # Mock value
        "biography": "Private investor with a background in consumer technology and fintech.",
        "photo_url": "", 
        "is_insider": False,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }

    profiles_to_insert = [kushal, manish, ankit]

    for profile_data in profiles_to_insert:
        try:
            # Check if profile already exists to avoid duplicates (by name)
            exists_query = session.query(investor_profiles).filter_by(name=profile_data['name']).first()
            
            if exists_query:
                logger.info(f"Profile for {profile_data['name']} already exists. Updating...")
                stmt = investor_profiles.update().where(investor_profiles.c.name == profile_data['name']).values(**profile_data)
                session.execute(stmt)
            else:
                logger.info(f"Inserting new profile for {profile_data['name']}...")
                stmt = investor_profiles.insert().values(**profile_data)
                session.execute(stmt)
            
            session.commit()
            logger.info(f"Successfully processed {profile_data['name']}")

        except Exception as e:
            logger.error(f"Error processing {profile_data['name']}: {e}")
            session.rollback()

    session.close()

if __name__ == "__main__":
    create_mock_profiles()
