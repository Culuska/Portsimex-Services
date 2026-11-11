// Moves files uploaded before private storage into the PRIVATE Blob store
// and points each record at its private copy, so old links stop being the
// way to open them. Run once, after the private store is connected:
//
//   npx tsx scripts/make-files-private.ts                  (asks you to type MOVE)
//   npx tsx scripts/make-files-private.ts --delete-public  (also deletes the old public copies)
//
// Needs PRIVATE_BLOB_READ_WRITE_TOKEN and DATABASE_URL in .env (from
// `vercel env pull .env --environment=production`). Deleting the public
// copies also needs BLOB_READ_WRITE_TOKEN (the original store).
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { del, put } from "@vercel/blob";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PUBLIC_HOST = /\.public\.blob\.vercel-storage\.com$/;
const isPublic = (u: string | null): u is string => {
  try {
    return !!u && PUBLIC_HOST.test(new URL(u).hostname);
  } catch {
    return false;
  }
};

const privateToken = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
if (!privateToken) {
  console.error("PRIVATE_BLOB_READ_WRITE_TOKEN is missing. Connect the private Blob store to the project, then run: npx vercel env pull .env --environment=production");
  process.exit(1);
}
const deletePublic = process.argv.includes("--delete-public");
if (deletePublic && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("--delete-public needs BLOB_READ_WRITE_TOKEN (the original store) in .env.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Item = { label: string; url: string; save: (url: string) => Promise<unknown> };

async function main() {
  const [docs, receipts, bills, versions] = await Promise.all([
    prisma.jobDocument.findMany({ where: { fileUrl: { not: null } }, select: { id: true, fileUrl: true } }),
    prisma.expense.findMany({ where: { receiptUrl: { not: null } }, select: { id: true, receiptUrl: true } }),
    prisma.supplierBill.findMany({ where: { attachmentUrl: { not: null } }, select: { id: true, attachmentUrl: true } }),
    prisma.clearanceDocumentVersion.findMany({ select: { id: true, fileUrl: true } }),
  ]);
  const items: Item[] = [
    ...docs.filter((d) => isPublic(d.fileUrl)).map((d) => ({ label: `job document ${d.id}`, url: d.fileUrl!, save: (url: string) => prisma.jobDocument.update({ where: { id: d.id }, data: { fileUrl: url } }) })),
    ...receipts.filter((e) => isPublic(e.receiptUrl)).map((e) => ({ label: `expense receipt ${e.id}`, url: e.receiptUrl!, save: (url: string) => prisma.expense.update({ where: { id: e.id }, data: { receiptUrl: url } }) })),
    ...bills.filter((b) => isPublic(b.attachmentUrl)).map((b) => ({ label: `supplier bill ${b.id}`, url: b.attachmentUrl!, save: (url: string) => prisma.supplierBill.update({ where: { id: b.id }, data: { attachmentUrl: url } }) })),
    ...versions.filter((v) => isPublic(v.fileUrl)).map((v) => ({ label: `clearance document ${v.id}`, url: v.fileUrl, save: (url: string) => prisma.clearanceDocumentVersion.update({ where: { id: v.id }, data: { fileUrl: url } }) })),
  ];
  console.log(`\nFiles still in the public store: ${items.length}`);
  if (items.length === 0) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Type MOVE to copy them to the private store${deletePublic ? " and DELETE the public copies" : ""} (anything else cancels): `)).trim();
  rl.close();
  if (answer !== "MOVE") return console.log("Cancelled -- nothing changed.");

  const moved: string[] = [];
  let failed = 0;
  for (const it of items) {
    try {
      const res = await fetch(it.url);
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      const pathname = decodeURIComponent(new URL(it.url).pathname.replace(/^\//, ""));
      const blob = await put(pathname, await res.blob(), { access: "private", token: privateToken, addRandomSuffix: true, contentType: res.headers.get("content-type") ?? undefined });
      await it.save(blob.url);
      moved.push(it.url);
      console.log(`moved  ${it.label}`);
    } catch (e) {
      failed++;
      console.log(`FAILED ${it.label}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (deletePublic && moved.length) {
    for (let i = 0; i < moved.length; i += 100) await del(moved.slice(i, i + 100), { token: process.env.BLOB_READ_WRITE_TOKEN });
    console.log(`Deleted ${moved.length} public copies.`);
  }
  console.log(`\nDone: ${moved.length} moved, ${failed} failed.${!deletePublic && moved.length ? " The old public copies were kept in the original store -- once you've checked the files open in the app, delete them there (Vercel -> Storage -> the original store)." : ""}`);
}

main()
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
