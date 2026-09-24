/**
 * Builds a dummy encrypted candidate import package for the CURRENT org's
 * migration public key (same wire format as build_test_package / client-lock-tool).
 *
 * Writes:
 *   docs/fixtures/dummy-candidates.migpkg  (canonical extension)
 *   docs/fixtures/dummy-candidates.pkg     (alias — some teams say ".pkg")
 *
 * Usage:
 *   CADENCE_FRONTEND=http://localhost:3000 node scripts/build-dummy-candidate-package.mjs
 *   node scripts/build-dummy-candidate-package.mjs --test-upload
 */
import {
  createCipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  constants,
} from "node:crypto";
import { execSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FIXTURES = join(REPO_ROOT, "docs", "fixtures");

const BASE = process.env.CADENCE_FRONTEND ?? "http://localhost:3000";
const ADMIN_LOGIN = process.env.CADENCE_ADMIN_LOGIN ?? "manaeygis@aeygis.com";
const ADMIN_PASSWORD = process.env.CADENCE_ADMIN_PASSWORD ?? "Aeygis@12345..0";

const SAMPLE_CSV = `first_name,last_name,employment_type,work_authorization,pay_method,join_date,sin,dob,bank_account,bank_transit,email
Jane,Doe,full_time,citizen_pr,etransfer,2024-03-01,391417771,1990-05-14,000123456,12345,jane.doe@example.com
John,Smith,part_time,permit,direct_deposit,2023-11-20,731706693,1988-01-30,000654321,54321,john.smith@example.com
`;

const SAMPLE_DOCS = {
  "documents/[Jane Doe] Drivers License.pdf": "%PDF-1.4 fake drivers license bytes",
  "documents/[Jane Doe] Resume.pdf": "%PDF-1.4 fake resume bytes",
  "documents/[John Smith] Work Permit.pdf": "%PDF-1.4 fake work permit bytes",
  "documents/[Nobody Matching] Passport.jpg": "fake passport bytes, no CSV row matches",
};

function parseCookies(setCookieHeaders, existing = "") {
  const map = new Map();
  for (const part of existing.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    map.set(t.slice(0, eq), t.slice(eq + 1));
  }
  for (const raw of setCookieHeaders) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function apiJson(method, path, { body, cookie } = {}) {
  const headers = { Accept: "application/json" };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const csrf = cookie?.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
  if (csrf && !["GET", "HEAD"].includes(method)) {
    headers["X-CSRFToken"] = decodeURIComponent(csrf);
  }
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookieOut = parseCookies(setCookie, cookie ?? "");
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.status >= 400) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return { data, cookie: cookieOut };
}

async function fetchPublicKeyDer() {
  const res = await fetch(`${BASE}/api/v1/candidate-imports/public-key/`);
  if (!res.ok) {
    throw new Error(`public-key → ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function buildZipBytes() {
  const dir = mkdtempSync(join(tmpdir(), "cadence-import-"));
  writeFileSync(join(dir, "candidates.csv"), SAMPLE_CSV, "utf8");
  for (const [relPath, text] of Object.entries(SAMPLE_DOCS)) {
    const full = join(dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  }
  const zipPath = join(dir, "package.zip");
  execSync(`cd "${dir}" && zip -rq "${zipPath}" candidates.csv documents`, {
    stdio: "pipe",
  });
  return readFileSync(zipPath);
}

function encryptPackage(zipBytes, orgId, publicKeyDer) {
  const publicKey = createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
  const aesKey = randomBytes(32);
  const nonce = randomBytes(12);
  const aad = Buffer.from(`cadence:migration-intake:v1:${orgId}`, "utf8");
  const cipher = createCipheriv("aes-256-gcm", aesKey, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(zipBytes), cipher.final(), cipher.getAuthTag()]);
  const wrappedKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey,
  );
  const lengthPrefix = Buffer.alloc(2);
  lengthPrefix.writeUInt16BE(wrappedKey.length, 0);
  return Buffer.concat([lengthPrefix, wrappedKey, nonce, ciphertext]);
}

async function login() {
  const r = await apiJson("POST", "/api/v1/auth/login/", {
    body: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
  });
  return r.cookie;
}

async function getOrgId(cookie) {
  const { data } = await apiJson("GET", "/api/v1/auth/me/", { cookie });
  return data.user.org_id;
}

async function uploadPackage(cookie, packageBytes, filename) {
  const csrf = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
  const form = new FormData();
  form.append("file", new Blob([packageBytes]), filename);
  const res = await fetch(`${BASE}/api/v1/candidate-imports/`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      ...(csrf ? { "X-CSRFToken": decodeURIComponent(csrf) } : {}),
    },
    body: form,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.status >= 400) {
    throw new Error(`upload → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

async function pollBatch(cookie, batchId, { timeoutMs = 120_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await apiJson("GET", `/api/v1/candidate-imports/${batchId}/`, { cookie });
    if (["validated", "failed", "committed", "committed_with_errors"].includes(data.status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`batch ${batchId} did not settle within ${timeoutMs / 1000}s`);
}

function buildViaLocalDjango(orgId, migpkgPath) {
  const backendDir = join(REPO_ROOT, "..", "app-cadence", "Backend");
  mkdirSync(dirname(migpkgPath), { recursive: true });
  execSync(
    `uv run python manage.py build_test_package --org ${orgId} --out "${migpkgPath}"`,
    { cwd: backendDir, stdio: "inherit" },
  );
  return readFileSync(migpkgPath);
}

async function main() {
  const testUpload = process.argv.includes("--test-upload");
  const forceLocal = process.argv.includes("--local-kms");
  console.log(`API base (via frontend proxy): ${BASE}`);

  let cookie = await login();
  const orgId = await getOrgId(cookie);
  console.log(`Org id for package AAD: ${orgId}`);

  mkdirSync(FIXTURES, { recursive: true });
  const migpkgPath = join(FIXTURES, "dummy-candidates.migpkg");
  const pkgPath = join(FIXTURES, "dummy-candidates.pkg");

  let packageBytes;
  if (forceLocal) {
    console.log("Building with local Django KMS (build_test_package)…");
    packageBytes = buildViaLocalDjango(orgId, migpkgPath);
  } else {
    try {
      const publicKeyDer = await fetchPublicKeyDer();
      const zipBytes = buildZipBytes();
      packageBytes = encryptPackage(zipBytes, orgId, publicKeyDer);
      writeFileSync(migpkgPath, packageBytes);
    } catch (err) {
      console.warn(`Remote public-key path failed (${err.message}). Trying local build_test_package…`);
      packageBytes = buildViaLocalDjango(orgId, migpkgPath);
      console.warn(
        "Package uses LOCAL dev KMS. It will only validate on an API using the same local key — not production.",
      );
    }
  }

  copyFileSync(migpkgPath, pkgPath);
  console.log(`Wrote ${packageBytes.length} bytes → ${migpkgPath}`);
  console.log(`Copy → ${pkgPath}`);

  if (!testUpload) {
    console.log("\nUpload test skipped. Run with --test-upload to verify import pipeline.");
    return;
  }

  console.log("\nUploading dummy-candidates.migpkg…");
  const batch = await uploadPackage(cookie, packageBytes, "dummy-candidates.migpkg");
  console.log(`Batch ${batch.id} status=${batch.status}`);

  console.log("Waiting for validation…");
  const settled = await pollBatch(cookie, batch.id);
  console.log(
    `Final status=${settled.status} rows=${settled.row_count} valid=${settled.valid_row_count}`,
  );

  if (settled.status === "failed") {
    process.exitCode = 1;
    console.error("Validation failed — check batch error on /candidate-imports in the UI.");
  } else if (settled.status === "validated") {
    console.log("Import candidate upload + validate: OK");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
