import { describe, expect, it, vi } from "vitest";
import { isPrivateBlobUrl, readStoredFile } from "./blob";

describe("stored files", () => {
  it("recognises private blob addresses", () => {
    expect(isPrivateBlobUrl("https://abc.private.blob.vercel-storage.com/jobs/x.pdf")).toBe(true);
    expect(isPrivateBlobUrl("https://abc.public.blob.vercel-storage.com/jobs/x.pdf")).toBe(false);
    expect(isPrivateBlobUrl("not a url")).toBe(false);
  });
  it("never fetches anything but Vercel Blob storage", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const u of ["http://169.254.169.254/latest/meta-data", "https://evil.example.com/x.pdf", "https://public.blob.vercel-storage.com.evil.com/x", "file:///etc/passwd"]) {
      expect(await readStoredFile(u)).toBeNull();
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
