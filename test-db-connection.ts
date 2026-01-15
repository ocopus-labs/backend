import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
    
    await prisma.$connect();
    console.log('✅ Successfully connected to the database!');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Query successful:', result);
    
    await prisma.$disconnect();
    console.log('✅ Disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
