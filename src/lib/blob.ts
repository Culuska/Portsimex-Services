import { put } from "@vercel/blob";

export async function uploadClearanceFile(file: File, shipmentId: string) {
  const key = `clearance/${shipmentId}/${Date.now()}-${file.name}`;
  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return { url: blob.url, fileName: file.name };
}
