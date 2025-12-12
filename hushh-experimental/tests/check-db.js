const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkDatabase() {
  try {
    console.log("🔍 Checking database...\n");

    // Check form submissions
    const submissions = await prisma.formSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    console.log("📝 Recent Form Submissions:");
    console.log("========================");
    submissions.forEach((sub, index) => {
      console.log(`${index + 1}. ${sub.name} (${sub.email})`);
      console.log(`   Institution: ${sub.company || "N/A"}`);
      console.log(`   Phone: ${sub.phone || "N/A"}`);
      console.log(`   Message: ${sub.message.substring(0, 50)}...`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Created: ${sub.createdAt}`);
      console.log(`   Email Sent: ${sub.emailSent ? "Yes" : "No"}`);
      console.log("");
    });

    // Check email logs
    const emailLogs = await prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    console.log("📧 Recent Email Logs:");
    console.log("===================");
    emailLogs.forEach((log, index) => {
      console.log(`${index + 1}. To: ${log.toEmail}`);
      console.log(`   Subject: ${log.subject}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   Template: ${log.template}`);
      console.log(`   Created: ${log.createdAt}`);
      if (log.errorMessage) {
        console.log(`   Error: ${log.errorMessage}`);
      }
      console.log("");
    });
  } catch (error) {
    console.error("❌ Error checking database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
