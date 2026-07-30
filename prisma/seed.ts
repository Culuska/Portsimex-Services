import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPasswordHash = await bcrypt.hash("ChangeMe123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@portsimex.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@portsimex.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const staffPasswordHash = await bcrypt.hash("ChangeMe123!", 10);
  const staff = await prisma.user.upsert({
    where: { email: "ops@portsimex.com" },
    update: {},
    create: {
      name: "Ops Staff",
      email: "ops@portsimex.com",
      passwordHash: staffPasswordHash,
      role: "STAFF",
    },
  });

  const categoryNames = [
    "Fuel",
    "Port Fees",
    "Customs",
    "Trucking",
    "Labor",
    "Office",
    "Other",
  ];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.expenseCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const client = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "Atlas Trading Co.",
      email: "ops@atlastrading.example",
      phone: "+252-61-000-0000",
      address: "Mogadishu Port Road, Mogadishu",
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { id: "seed-vendor-1" },
    update: {},
    create: {
      id: "seed-vendor-1",
      name: "Coastal Trucking Ltd.",
      service: "Trucking",
      email: "dispatch@coastaltrucking.example",
      phone: "+252-61-111-1111",
    },
  });

  const shipment = await prisma.shipment.upsert({
    where: { reference: "PSX-2026-0001" },
    update: {},
    create: {
      reference: "PSX-2026-0001",
      type: "IMPORT",
      status: "IN_TRANSIT",
      origin: "Dubai, UAE",
      destination: "Mogadishu, Somalia",
      cargoDescription: "General cargo, 2x20ft containers",
      containerNumber: "MSKU1234567",
      vessel: "MV Horizon",
      etd: new Date("2026-07-10"),
      eta: new Date("2026-08-05"),
      clientId: client.id,
      assigneeId: staff.id,
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0001" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0001",
      status: "PARTIALLY_PAID",
      dueDate: new Date("2026-08-15"),
      clientId: client.id,
      shipmentId: shipment.id,
      items: {
        create: [
          { description: "Freight charges", quantity: 1, unitPrice: 4200 },
          { description: "Documentation fee", quantity: 1, unitPrice: 150 },
        ],
      },
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-payment-1" },
    update: {},
    create: {
      id: "seed-payment-1",
      invoiceId: invoice.id,
      amount: 2000,
      method: "BANK_TRANSFER",
      reference: "TXN-88213",
      paidAt: new Date("2026-07-20"),
    },
  });

  await prisma.expense.upsert({
    where: { id: "seed-expense-1" },
    update: {},
    create: {
      id: "seed-expense-1",
      description: "Trucking from port to warehouse",
      amount: 350,
      status: "PAID",
      incurredAt: new Date("2026-07-22"),
      paidAt: new Date("2026-07-22"),
      categoryId: categories.find((c) => c.name === "Trucking")!.id,
      vendorId: vendor.id,
      shipmentId: shipment.id,
    },
  });

  console.log("Seed complete.");
  console.log(`Admin login: admin@portsimex.com / ChangeMe123!`);
  console.log(`Staff login: ops@portsimex.com / ChangeMe123!`);
  console.log(`Created ${categories.length} expense categories.`);
  console.log({ adminId: admin.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
