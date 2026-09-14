import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const [email, password, name, roleArg] = process.argv.slice(2);

if (!email || !password || !name || (roleArg !== "ADMIN" && roleArg !== "STAFF")) {
  console.error(
    'Usage: npx tsx scripts/create-user.ts "email@example.com" "password" "Full Name" "ADMIN|STAFF"',
  );
  process.exit(1);
}

const role: "ADMIN" | "STAFF" = roleArg;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name, role },
    create: { email: email.toLowerCase(), passwordHash, name, role },
  });
  console.log(`User ready: ${user.email} (${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
