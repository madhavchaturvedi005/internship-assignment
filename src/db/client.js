const { PrismaClient } = require('@prisma/client');

// Single shared instance (never create multiple PrismaClient instances)
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

module.exports = prisma;