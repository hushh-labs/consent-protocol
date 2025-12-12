import 'dotenv/config'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaClient } from './generated/client/client'

const adminEmails = [
  { email: 'kushal@iwebtechno.com', name: 'Kushal' },
  { email: 'info@iwebtechno.com', name: 'Info' },
  { email: 'akshay@iwebtechno.com', name: 'Akshay' },
]

/**
 * Parse SQL Server connection string to config object
 * Format: sqlserver://server:port;database=db;user=user;password=pass;encrypt=true;...
 */
function parseConnectionString(connectionString: string) {
  // Remove protocol
  const withoutProtocol = connectionString.replace('sqlserver://', '')
  
  // Split by first semicolon to separate host:port from params
  const parts = withoutProtocol.split(';')
  const hostPart = parts[0]
  const paramParts = parts.slice(1)
  
  // Parse host:port
  const hostPortParts = hostPart.split(':')
  const server = hostPortParts[0]
  const port = parseInt(hostPortParts[1] || '1433', 10)
  
  // Parse key=value params
  const params: Record<string, string> = {}
  for (const part of paramParts) {
    const eqIndex = part.indexOf('=')
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).toLowerCase()
      const value = part.substring(eqIndex + 1)
      params[key] = value
    }
  }

  console.log('📦 Parsed connection config:', {
    server,
    port,
    database: params['database'],
    user: params['user'],
    encrypt: params['encrypt'],
  })

  return {
    server,
    port,
    database: params['database'] || '',
    user: params['user'] || '',
    password: params['password'] || '',
    options: {
      encrypt: params['encrypt'] === 'true',
      trustServerCertificate: params['trustservercertificate'] === 'true',
    },
  }
}

// Create Prisma Client with adapter
const config = parseConnectionString(process.env.DATABASE_URL || '')
const adapter = new PrismaMssql(config)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding admin emails...')

  for (const admin of adminEmails) {
    const result = await prisma.adminEmail.upsert({
      where: { email: admin.email },
      update: { name: admin.name, isActive: true },
      create: {
        email: admin.email,
        name: admin.name,
        isActive: true,
      },
    })
    console.log(`✅ Upserted admin email: ${result.email}`)
  }

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
