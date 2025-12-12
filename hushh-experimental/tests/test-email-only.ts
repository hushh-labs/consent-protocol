/**
 * Email-Only Test Script
 * Tests just the email sending functionality
 * 
 * Usage: npx tsx tests/test-email-only.ts [recipient@email.com]
 */

import 'dotenv/config';
import { TEST_EMAIL, TEST_FORM_DATA } from './lib/config';
import { 
  createTransporter, 
  verifyConnection,
  sendWelcomeEmail, 
  sendAdminNotification 
} from './lib/email';

async function testEmailOnly() {
  const recipient = process.argv[2] || TEST_EMAIL;
  
  console.log('📧 Testing Email Service');
  console.log('='.repeat(50));
  console.log(`📧 All emails will be sent to: ${recipient}\n`);

  // Check environment
  if (!process.env.EMAIL_SENDER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_SENDER or EMAIL_PASSWORD not found in environment');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   EMAIL_SENDER: ${process.env.EMAIL_SENDER}`);
  console.log(`   SMTP_SERVER: ${process.env.SMTP_SERVER || 'smtpout.secureserver.net'}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || '465'}\n`);

  const transporter = createTransporter();

  try {
    // Test 1: SMTP Connection
    console.log('📊 Test 1: Verify SMTP Connection');
    const smtpOk = await verifyConnection(transporter);
    if (!smtpOk) {
      throw new Error('SMTP connection failed');
    }
    console.log('✅ SMTP connection verified\n');

    // Test 2: Send Welcome Email
    console.log('📊 Test 2: Send Welcome Email');
    const welcomeResult = await sendWelcomeEmail(transporter, recipient, TEST_FORM_DATA);
    if (!welcomeResult.success) {
      throw new Error(`Welcome email failed: ${welcomeResult.error}`);
    }
    console.log(`✅ Welcome email sent! Message ID: ${welcomeResult.messageId}\n`);

    // Test 3: Send Admin Notification
    console.log('📊 Test 3: Send Admin Notification Email');
    const adminResult = await sendAdminNotification(transporter, recipient, TEST_FORM_DATA);
    if (!adminResult.success) {
      throw new Error(`Admin notification failed: ${adminResult.error}`);
    }
    console.log(`✅ Admin notification sent! Message ID: ${adminResult.messageId}\n`);

    console.log('='.repeat(50));
    console.log('🎉 All email tests passed!');
    console.log('='.repeat(50));
    console.log(`\n📧 Two emails have been sent to: ${recipient}`);
    console.log('   1. Welcome Email (what the requestor receives)');
    console.log('   2. Admin Notification (what admins receive)');

  } catch (error: any) {
    console.error('\n❌ Email test failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    transporter.close();
  }
}

testEmailOnly();
