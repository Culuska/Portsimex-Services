import { put } from "@vercel/blob";

export async function uploadClearanceFile(file: File, shipmentId: string) {
  const key = `clearance/${shipmentId}/${Date.now()}-${file.name}`;
  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return { url: blob.url, fileName: file.name };
}

// Job/Case documents (receipts, certificates, PODs, contracts...).
export async function uploadJobFile(file: File, jobId: string) {
  const key = `jobs/${jobId}/${Date.now()}-${file.name}`;
  const blob = await put(key, file, { access: "public", addRandomSuffix: true });
  return { url: blob.url, fileName: file.name };
}
