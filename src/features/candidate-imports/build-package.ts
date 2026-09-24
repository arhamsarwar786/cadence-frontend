import { strToU8, zipSync } from "fflate";
import { ApiError } from "@/api/client";

/** Matches build_test_package small fixed sample (candidates.csv + documents/). */
const SAMPLE_CSV = `first_name,last_name,employment_type,work_authorization,pay_method,join_date,sin,dob,bank_account,bank_transit,email
Jane,Doe,full_time,citizen_pr,etransfer,2024-03-01,391417771,1990-05-14,000123456,12345,jane.doe@example.com
John,Smith,part_time,permit,direct_deposit,2023-11-20,731706693,1988-01-30,000654321,54321,john.smith@example.com
`;

function sampleZipBytes(): Uint8Array {
  return zipSync({
    "candidates.csv": strToU8(SAMPLE_CSV),
    "documents/[Jane Doe] Drivers License.pdf": strToU8("%PDF-1.4 fake drivers license bytes"),
    "documents/[Jane Doe] Resume.pdf": strToU8("%PDF-1.4 fake resume bytes"),
    "documents/[John Smith] Work Permit.pdf": strToU8("%PDF-1.4 fake work permit bytes"),
    "documents/[Nobody Matching] Passport.jpg": strToU8("fake passport bytes, no CSV row matches"),
  });
}

export async function fetchMigrationPublicKey(): Promise<ArrayBuffer> {
  const res = await fetch("/api/v1/candidate-imports/public-key/", {
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text.slice(0, 500));
  }
  return res.arrayBuffer();
}

/** Wire format: candidate_imports.tasks.decrypt_package / client-lock-tool.html */
async function encryptZipForOrg(
  zipBytes: Uint8Array,
  orgId: string,
  publicKeyDer: ArrayBuffer,
): Promise<Uint8Array> {
  const publicKey = await crypto.subtle.importKey(
    "spki",
    publicKeyDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`cadence:migration-intake:v1:${orgId}`);
  const zipBuffer = new Uint8Array(zipBytes).buffer;
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, aesKey, zipBuffer),
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", aesKey));
  const wrappedKey = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey));

  const lengthPrefix = new Uint8Array(2);
  new DataView(lengthPrefix.buffer).setUint16(0, wrappedKey.length, false);

  const out = new Uint8Array(2 + wrappedKey.length + nonce.length + ciphertext.length);
  let offset = 0;
  out.set(lengthPrefix, offset);
  offset += 2;
  out.set(wrappedKey, offset);
  offset += wrappedKey.length;
  out.set(nonce, offset);
  offset += nonce.length;
  out.set(ciphertext, offset);
  return out;
}

export async function buildSampleImportPackage(orgId: string): Promise<Blob> {
  const publicKeyDer = await fetchMigrationPublicKey();
  const zipBytes = sampleZipBytes();
  const locked = await encryptZipForOrg(zipBytes, orgId, publicKeyDer);
  return new Blob([new Uint8Array(locked)], { type: "application/octet-stream" });
}

/** Health can be OK while this door fails — it alone talks to migration KMS. */
export function describeMigrationPublicKeyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 500) {
      return (
        "The API is running, but import encryption failed on the server (HTTP 500). " +
        "This endpoint loads the migration RSA public key from AWS KMS; health checks do not. " +
        "Your Cadence operator needs to fix migration intake KMS configuration on api.app-cadence.com."
      );
    }
    if (error.status === 503) {
      return "Candidate import encryption is not configured on this server yet.";
    }
    if (error.status === 0) {
      return "Could not reach the API. Check your network and that the frontend proxy can reach the backend.";
    }
    return `Import encryption key request failed (HTTP ${error.status}).`;
  }
  return "Could not load the import encryption key.";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
