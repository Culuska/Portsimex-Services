import { get, put } from "@vercel/blob";

// File storage. Uploaded files are private: they are never opened through
// their storage address, only through /files/... in the app, which checks
// that the person is signed in and allowed to see the record.
//
// New uploads go to the PRIVATE Blob store when it is connected to the
// project (env PRIVATE_BLOB_READ_WRITE_TOKEN). Until then they fall back to
// the original store, still served only through the app.

const privateToken = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || undefined;

async function store(key: string, file: File) {
  const token = privateToken();
  const blob = token
    ? await put(key, file, { access: "private", token, addRandomSuffix: true })
    : await put(key, file, { access: "public", addRandomSuffix: true });
  return { url: blob.url, fileName: file.name };
}

export async function uploadClearanceFile(file: File, shipmentId: string) {
  return store(`clearance/${shipmentId}/${Date.now()}-${file.name}`, file);
}

// Job/Case documents (receipts, certificates, PODs, contracts...).
export async function uploadJobFile(file: File, jobId: string) {
  return store(`jobs/${jobId}/${Date.now()}-${file.name}`, file);
}

const PRIVATE_HOST = /\.private\.blob\.vercel-storage\.com$/;
const PUBLIC_HOST = /\.public\.blob\.vercel-storage\.com$/;

export function isPrivateBlobUrl(url: string) {
  try {
    return PRIVATE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Reads a stored file for /files/... (after the caller has checked access).
 * Only Vercel Blob addresses are ever fetched, so a stored value can't be
 * used to make the server request anything else.
 */
export async function readStoredFile(url: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  try {
    if (PRIVATE_HOST.test(host)) {
      const r = await get(url, { access: "private", token: privateToken() });
      if (!r || r.statusCode !== 200) return null;
      return { stream: r.stream, contentType: r.blob.contentType || "application/octet-stream" };
    }
    if (PUBLIC_HOST.test(host)) {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok || !r.body) return null;
      return { stream: r.body, contentType: r.headers.get("content-type") || "application/octet-stream" };
    }
  } catch (e) {
    console.error("Reading a stored file failed:", e instanceof Error ? e.message : e);
  }
  return null;
}
