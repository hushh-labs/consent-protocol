/**
 * Database-Only Test Script
 * Tests just the database connection and CRUD operations
 * 
 * Usage: npx tsx tests/test-db-only.ts
 */

import 'dotenv/config';
import { TEST_FORM_DATA } from './lib/config';
import { 
  createPrismaClient, 
  parseConnectionString,
  createTestSubmission, 
  getAdminEmails,
  cleanupTestSubmissions 
} from './lib/db';

async function testDatabaseOnly() {
  console.log('🔍 Testing Database Connection');
  console.log('='.repeat(50) + '\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Show connection info
  const config = parseConnectionString(process.env.DATABASE_URL);
  console.log('📦 Connection config:', {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
  });

  const prisma = createPrismaClient();

  try {
    // Test 1: Connection
    console.log('\n📊 Test 1: Database Connection');
    await prisma.$connect();
    console.log('✅ Database connected successfully!');

    // Test 2: Query AdminEmails
    console.log('\n📊 Test 2: Query AdminEmails');
    const adminEmails = await getAdminEmails(prisma);
    console.log(`✅ Found ${adminEmails.length} active admin emails:`);
    adminEmails.forEach(email => console.log(`   - ${email}`));

    // Test 3: Create test FormSubmission
    console.log('\n📊 Test 3: Create Test FormSubmission');
    const submission = await createTestSubmission(prisma, TEST_FORM_DATA);
    console.log(`✅ Created test submission with ID: ${submission.id}`);

    // Test 4: Query to verify
    console.log('\n📊 Test 4: Verify Submission');
    const verify = await prisma.formSubmission.findUnique({
      where: { id: submission.id },
    });
    console.log(`✅ Verified: ${verify?.name} - ${verify?.email}`);

    // Test 5: Cleanup
    console.log('\n📊 Test 5: Cleanup');
    const deleted = await cleanupTestSubmissions(prisma);
    console.log(`✅ Cleaned up ${deleted} test submission(s)`);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All database tests passed!');
    console.log('='.repeat(50));
  } catch (error: any) {
    console.error('\n❌ Database test failed:', error.message);
    
    // Try cleanup
    await cleanupTestSubmissions(prisma);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseOnly();
