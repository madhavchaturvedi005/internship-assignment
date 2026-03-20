generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  role         String   // "Admin" or "Customer"
  passwordHash String
  createdAt    DateTime @default(now())
  devices      Device[]
}

model Device {
  imei          String         @id
  vehicleNumber String
  customerId    String?
  createdAt     DateTime       @default(now())
  customer      User?          @relation(fields: [customerId], references: [id])
  locationLogs  LocationLog[]

  @@index([customerId])  // faster lookup by customer
}

model LocationLog {
  id        String   @id @default(uuid())
  imei      String
  lat       Float
  lng       Float
  speed     Float
  ignition  Boolean
  timestamp DateTime
  createdAt DateTime @default(now())
  device    Device   @relation(fields: [imei], references: [imei])

  @@index([imei])        // fast history lookup by device
  @@index([timestamp])   // fast time-range queries
}