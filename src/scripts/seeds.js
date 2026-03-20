require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const bcrypt = require('bcryptjs');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function seed() {
  // Create Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fleetpulse.com' },
    update: {},
    create: {
      email: 'admin@fleetpulse.com',
      role: 'Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
    },
  });

  // Create Customer user
  const customer = await prisma.user.upsert({
    where: { email: 'customer@fleetpulse.com' },
    update: {},
    create: {
      email: 'customer@fleetpulse.com',
      role: 'Customer',
      passwordHash: await bcrypt.hash('customer123', 10),
    },
  });

  // Create 5 registered devices
  const devices = [
    { imei: '354678901234561', vehicleNumber: 'MH12AB1234', customerId: customer.id },
    { imei: '354678901234562', vehicleNumber: 'MH12AB5678', customerId: customer.id },
    { imei: '354678901234563', vehicleNumber: 'MH14CD9012', customerId: admin.id },
    { imei: '354678901234564', vehicleNumber: 'MH14CD3456', customerId: null },
    { imei: '354678901234565', vehicleNumber: 'MH16EF7890', customerId: null },
  ];

  for (const device of devices) {
    await prisma.device.upsert({
      where: { imei: device.imei },
      update: {},
      create: device,
    });
  }

  console.log('Seed complete! Users and devices created.');
  await prisma.$disconnect();
}

seed().catch(console.error);