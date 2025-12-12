/**
 * Database Cleanup Script
 * Removes ALL submissions from the database (clean wipe)
 * 
 * Usage: npx tsx tests/cleanup-db.ts
 */

import 'dotenv/config';
import { createPrismaClient, parseConnectionString } from './lib/db';

async function cleanupDatabase() {
  console.log('🧹 Database Cleanup - FULL WIPE');
  console.log('='.repeat(50) + '\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const config = parseConnectionString(process.env.DATABASE_URL);
  console.log('📦 Connected to:', config.database);

  const prisma = createPrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // Count current submissions
    const count = await prisma.formSubmission.count();
    console.log(`📊 Found ${count} submission(s) in database\n`);

    if (count === 0) {
      console.log('✅ Database is already empty!\n');
      return;
    }

    // Delete ALL submissions
    console.log('🗑️  Deleting ALL submissions...\n');
    
    const result = await prisma.formSubmission.deleteMany({});

    console.log('='.repeat(50));
    console.log(`🎉 Cleanup complete! Deleted ${result.count} submission(s).`);
    console.log('='.repeat(50));

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
