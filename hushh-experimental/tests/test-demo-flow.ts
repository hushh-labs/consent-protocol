/**
 * Full Demo Flow Test Script
 * Simulates the complete schedule-demo form submission:
 * 1. Creates a FormSubmission in the database
 * 2. Sends Welcome Email to the submitter
 * 3. Sends Admin Notification Email to admins
 * 4. Cleans up test data
 * 
 * Usage: npx tsx tests/test-demo-flow.ts
 */

import 'dotenv/config';
import { TEST_EMAIL, TEST_FORM_DATA } from './lib/config';
import { 
  createPrismaClient, 
  createTestSubmission, 
  markEmailSent,
  cleanupTestSubmissions 
} from './lib/db';
import { 
  createTransporter, 
  verifyConnection,
  sendWelcomeEmail, 
  sendAdminNotification 
} from './lib/email';

async function testDemoFlow() {
  console.log('🧪 Testing Full Demo Flow');
  console.log('='.repeat(50));
  console.log(`📧 All emails will be sent to: ${TEST_EMAIL}\n`);

  // Check environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }
  if (!process.env.EMAIL_SENDER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_SENDER or EMAIL_PASSWORD not found in environment');
    process.exit(1);
  }

  // Initialize
  const prisma = createPrismaClient();
  const transporter = createTransporter();

  try {
    // Step 1: Database Connection
    console.log('📊 Step 1: Database Connection');
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Step 2: Create FormSubmission
    console.log('📊 Step 2: Create FormSubmission');
    const submission = await createTestSubmission(prisma, TEST_FORM_DATA);
    console.log(`✅ FormSubmission created with ID: ${submission.id}\n`);

    // Step 3: Verify SMTP Connection
    console.log('📊 Step 3: Verify SMTP Connection');
    const smtpOk = await verifyConnection(transporter);
    if (!smtpOk) {
      throw new Error('SMTP connection failed');
    }
    console.log('✅ SMTP connection verified\n');

    // Step 4: Send Welcome Email
    console.log('📊 Step 4: Send Welcome Email');
    const welcomeResult = await sendWelcomeEmail(transporter, TEST_EMAIL, TEST_FORM_DATA);
    if (!welcomeResult.success) {
      throw new Error(`Welcome email failed: ${welcomeResult.error}`);
    }
    console.log(`✅ Welcome email sent! Message ID: ${welcomeResult.messageId}\n`);

    // Step 5: Send Admin Notification Email
    console.log('📊 Step 5: Send Admin Notification Email');
    const adminResult = await sendAdminNotification(transporter, TEST_EMAIL, TEST_FORM_DATA);
    if (!adminResult.success) {
      throw new Error(`Admin notification failed: ${adminResult.error}`);
    }
    console.log(`✅ Admin notification sent! Message ID: ${adminResult.messageId}\n`);

    // Step 6: Update submission to mark email as sent
    console.log('📊 Step 6: Update FormSubmission (mark email sent)');
    await markEmailSent(prisma, submission.id);
    console.log('✅ FormSubmission updated with emailSent=true\n');

    // Step 7: Cleanup
    console.log('📊 Step 7: Cleanup Test Data');
    const deleted = await cleanupTestSubmissions(prisma);
    console.log(`✅ Cleaned up ${deleted} test submission(s)\n`);

    // Summary
    console.log('='.repeat(50));
    console.log('🎉 FULL DEMO FLOW TEST PASSED!');
    console.log('='.repeat(50));
    console.log(`\n📧 Two emails have been sent to: ${TEST_EMAIL}`);
    console.log('   1. Welcome Email (what the requestor receives)');
    console.log('   2. Admin Notification (what admins receive)');
    console.log('\n✅ Test data has been cleaned up from the database.');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    
    // Try to cleanup even on failure
    console.log('\n🧹 Attempting cleanup...');
    const deleted = await cleanupTestSubmissions(prisma);
    console.log(`   Cleaned up ${deleted} test submission(s)`);
    
    process.exit(1);
  } finally {
    transporter.close();
    await prisma.$disconnect();
  }
}

testDemoFlow();
