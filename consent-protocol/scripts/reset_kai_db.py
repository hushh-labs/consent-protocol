import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load params from .env or default to local/proxy
load_dotenv()

DB_DSN = os.getenv("DATABASE_URL", "postgresql://hushh_impl:implementor_access@localhost:5432/hushh_db")

RESET_SQL = """
-- 1. Drop old tables
DROP TABLE IF EXISTS kai_decisions CASCADE;
DROP TABLE IF EXISTS kai_sessions CASCADE;

-- 2. Create kai_sessions (Clean)
CREATE TABLE kai_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    processing_mode VARCHAR(32) DEFAULT 'hybrid', -- 'on_device', 'hybrid'
    risk_profile VARCHAR(32) DEFAULT 'balanced', -- 'conservative', 'balanced', 'aggressive'
    legal_acknowledged BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_kai_sessions_user ON kai_sessions(user_id);

-- 3. Create kai_decisions (Zero-Knowledge)
CREATE TABLE kai_decisions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(64) REFERENCES kai_sessions(session_id),
    
    -- Metadata (Plaintext for sorting/listing)
    ticker VARCHAR(16) NOT NULL,
    decision_type VARCHAR(16),  -- 'buy', 'hold', 'reduce'
    confidence_score FLOAT, 
    
    -- Encrypted Payload (Client Encrypted Only)
    -- Server CANNOT decrypt this.
    decision_ciphertext TEXT NOT NULL, 
    iv VARCHAR(64) NOT NULL,
    tag VARCHAR(64),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_kai_decisions_user ON kai_decisions(user_id);
"""

async def reset_db():
    print(f"🔄 Connecting to DB at {DB_DSN.split('@')[1]}...")
    try:
        conn = await asyncpg.connect(DB_DSN)
        print("✅ Connected. Accessing DB...")
        
        # Run script
        await conn.execute(RESET_SQL)
        print("✅ Kai Database Reset & Restructured successfully!")
        
        await conn.close()
    except Exception as e:
        print(f"❌ Error resetting DB: {e}")

if __name__ == "__main__":
    asyncio.run(reset_db())
