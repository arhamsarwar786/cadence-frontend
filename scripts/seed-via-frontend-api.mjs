/**
 * Seeds the deployed backend through http://localhost:3000/api/v1/* (same as the UI).
 * Run: node scripts/seed-via-frontend-api.mjs
 */
const BASE = process.env.CADENCE_FRONTEND ?? "http://localhost:3000";
const ADMIN_LOGIN = process.env.CADENCE_ADMIN_LOGIN ?? "manaeygis@aeygis.com";
const ADMIN_PASSWORD = process.env.CADENCE_ADMIN_PASSWORD ?? "Aeygis@12345..0";
const DEMO_PASSWORD = "CadenceDemo@2026!";

const STAFF_ROLES = [
  {
    key: "recruiter",
    email: "demo.recruiter@aeygis.com",
    grants: [
      "workers.view",
      "workers.create",
      "workers.edit",
      "workers.onboarding.approve",
      "workers.profile.manage",
      "workers.ratings.view",
      "clients.view",
      "clients.create",
      "clients.edit",
      "clients.contacts.manage",
      "jobs.view",
      "jobs.create",
      "jobs.edit",
      "jobs.bill_rate.view",
      "jobs.bill_rate.edit",
      "jobs.assign",
      "shifts.view",
      "shifts.edit",
      "hoursheets.view",
      "hoursheets.edit",
      "documents.view",
      "documents.upload",
      "documents.download",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "tasks.complete",
    ],
  },
  {
    key: "billing",
    email: "demo.billing@aeygis.com",
    grants: [
      "clients.view",
      "clients.markup.view",
      "clients.invoice.create",
      "clients.invoice.edit",
      "clients.invoice.approve",
      "invoices.send",
      "invoices.mark_paid",
      "jobs.view",
      "jobs.bill_rate.view",
      "tasks.view",
      "tasks.complete",
    ],
  },
  {
    key: "payroll",
    email: "demo.payroll@aeygis.com",
    grants: [
      "payroll.page.view",
      "payroll.run",
      "payroll.pay_statements.view",
      "payroll.pay_statements.edit",
      "payroll.approve",
      "payroll.release",
      "payroll.pay_statements.generate",
      "payroll.export",
      "workers.view",
      "hoursheets.view",
      "hoursheets.approve",
      "tasks.view",
      "tasks.complete",
    ],
  },
  {
    key: "compliance",
    email: "demo.compliance@aeygis.com",
    grants: [
      "audit.log.view",
      "pii.sin.view_masked",
      "pii.dob.view_masked",
      "pii.govid.view",
      "privacy.requests.view",
      "privacy.requests.manage",
      "privacy.breaches.view",
      "privacy.breaches.manage",
      "workers.view",
      "workers.background_check.view",
      "tasks.view",
      "tasks.complete",
    ],
  },
  {
    key: "readonly",
    email: "demo.readonly@aeygis.com",
    grants: [
      "clients.view",
      "workers.view",
      "jobs.view",
      "shifts.view",
      "hoursheets.view",
      "tasks.view",
      "payroll.page.view",
      "payroll.pay_statements.view",
      "documents.view",
    ],
  },
  {
    key: "scheduler",
    email: "demo.scheduler@aeygis.com",
    grants: [
      "jobs.view",
      "jobs.edit",
      "jobs.assign",
      "shifts.view",
      "shifts.edit",
      "hoursheets.view",
      "hoursheets.edit",
      "workers.view",
      "workers.ratings.view",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
    ],
  },
];

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

async function api(method, path, { body, cookie } = {}) {
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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
  });
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
    const err = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { data, cookie: cookieOut };
}

async function login(login, password, cookie = "") {
  const r = await api("POST", "/api/v1/auth/login/", {
    body: { login, password },
    cookie,
  });
  return r.cookie || cookie;
}

async function ensureStaffUser(adminCookie, role) {
  let userId;
  try {
    const inv = await api("POST", "/api/v1/auth/users/invite/", {
      body: { email: role.email },
      cookie: adminCookie,
    });
    userId = inv.data.user?.id ?? inv.data.id;
    const token = inv.data.invite_token;
    if (token) {
      await api("POST", "/api/v1/auth/invite/accept/", {
        body: { token, password: DEMO_PASSWORD },
      });
    }
  } catch (e) {
    if (e.status !== 400 && e.status !== 409) throw e;
    const users = await api("GET", "/api/v1/auth/users/?page_size=200", { cookie: adminCookie });
    const list = Array.isArray(users.data) ? users.data : users.data.results ?? [];
    const masked = role.email[0] + "***@" + role.email.split("@")[1];
    const hit = list.find(
      (u) =>
        (u.login?.toLowerCase() === role.email.toLowerCase() ||
          (u.login_masked?.toLowerCase().includes(role.email[0].toLowerCase()) &&
            u.login_masked?.toLowerCase().includes(role.email.split("@")[1].toLowerCase()))),
    );
    if (!hit) throw e;
    userId = hit.id;
    await api("POST", `/api/v1/auth/users/${userId}/reset-credentials/`, {
      body: { password: DEMO_PASSWORD },
      cookie: adminCookie,
    });
  }
  const grants = role.grants.map((permission_key) => ({ permission_key, scope: "all" }));
  await api("PUT", `/api/v1/auth/users/${userId}/permissions/`, {
    body: { grants },
    cookie: adminCookie,
  });
  return { id: userId, email: role.email, role: role.key };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

async function main() {
  const report = { credentials: [], counts: {}, notes: [] };
  let cookie = "";
  const warm = await api("GET", "/login/agency");
  cookie = warm.cookie || cookie;
  cookie = await login(ADMIN_LOGIN, ADMIN_PASSWORD, cookie);
  const me = await api("GET", "/api/v1/auth/me/", { cookie });
  console.log("Admin org:", me.data.organization?.name ?? me.data.org_id);

  report.credentials.push({
    role: "admin (root)",
    login: ADMIN_LOGIN,
    password: ADMIN_PASSWORD,
    portal: "Agency login → http://localhost:3000/login/agency",
  });

  for (const role of STAFF_ROLES) {
    process.stdout.write(`Staff role: ${role.key}… `);
    try {
      const u = await ensureStaffUser(cookie, role);
      report.credentials.push({
        role: `staff · ${role.key}`,
        login: u.email,
        password: DEMO_PASSWORD,
        portal: "Agency login",
      });
      console.log("ok");
    } catch (e) {
      console.log("FAILED", e.message);
      report.notes.push(`staff ${role.key}: ${e.message}`);
    }
  }

  const cities = [
    ["Toronto", "ON", "M5V1A1"],
    ["Vancouver", "BC", "V6B1A1"],
    ["Calgary", "AB", "T2P1A1"],
    ["Montreal", "QC", "H2Y1A1"],
    ["Ottawa", "ON", "K1P1A1"],
  ];
  const clientIds = [];
  const runTag = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= 18; i++) {
    const [city, province, postal] = cities[i % cities.length];
    try {
      const c = await api("POST", "/api/v1/clients/", {
        cookie,
        body: {
          name: `Demo Client ${runTag} #${pad(i)} — ${city}`,
          markup_pct: String(15 + (i % 10)),
          address_line_1: `${100 + i} King St W`,
          city,
          province,
          postal_code: postal,
          status: i % 5 === 0 ? "inactive" : "active",
        },
      });
      clientIds.push(c.data.id);
    } catch (e) {
      if (e.status === 400 && String(e.message).includes("already")) continue;
      report.notes.push(`client ${i}: ${e.message}`);
    }
  }
  report.counts.clients = clientIds.length;

  const workerIds = [];
  const firstNames = ["Maya", "Liam", "Jordan", "Sam", "Alex", "Taylor", "Riley", "Casey", "Quinn", "Avery"];
  const lastNames = ["Chen", "Patel", "Nguyen", "Singh", "Martin", "Brown", "Lee", "Wilson", "Garcia", "Kim"];
  for (let i = 1; i <= 35; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = `${lastNames[(i * 3) % lastNames.length]}-${i}`;
    try {
      const w = await api("POST", "/api/v1/workers/", {
        cookie,
        body: {
          first_name: fn,
          last_name: ln,
          email: `worker.${i}.demo@aeygis.com`,
          phone: `416555${pad(i % 100)}${pad((i * 7) % 100)}`.slice(0, 10),
          city: cities[i % cities.length][0],
          province: cities[i % cities.length][1],
          postal_code: cities[i % cities.length][2],
          address_line_1: `${200 + i} Demo Ave`,
          employment_type: i % 3 === 0 ? "part_time" : "full_time",
          contractor_tag: i % 4 === 0,
        },
      });
      workerIds.push(w.data.id);
      if (i % 2 === 0) {
        await api("POST", `/api/v1/workers/${w.data.id}/submit/`, { cookie });
        await api("POST", `/api/v1/workers/${w.data.id}/approve/`, { cookie });
      }
    } catch (e) {
      report.notes.push(`worker ${i}: ${e.message}`);
    }
  }
  report.counts.workers = workerIds.length;

  const jobIds = [];
  const now = new Date();
  for (let i = 1; i <= 22; i++) {
    const clientId = clientIds[i % clientIds.length];
    if (!clientId) continue;
    const start = new Date(now);
    start.setDate(start.getDate() + (i % 14));
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 5 + (i % 10));
    end.setHours(17, 0, 0, 0);
    try {
      const j = await api("POST", "/api/v1/jobs/", {
        cookie,
        body: {
          title: `Demo placement ${i} — warehouse / admin`,
          client: clientId,
          bill_rate: String(28 + (i % 12)),
          bill_rate_unit: "hr",
          headcount_needed: 1 + (i % 3),
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
          po_number: `PO-DEMO-${1000 + i}`,
        },
      });
      jobIds.push(j.data.id);
      const emp = workerIds[i % workerIds.length];
      if (emp) {
        try {
          await api("POST", `/api/v1/jobs/${j.data.id}/assignments/`, {
            cookie,
            body: { employee_id: emp },
          });
        } catch {
          /* rating / lifecycle gate */
        }
      }
    } catch (e) {
      report.notes.push(`job ${i}: ${e.message}`);
    }
  }
  report.counts.jobs = jobIds.length;

  let tasks = 0;
  for (let i = 1; i <= 40; i++) {
    try {
      await api("POST", "/api/v1/tasks/", {
        cookie,
        body: {
          title: `Follow-up demo task #${i}`,
          due_date: new Date(now.getTime() + i * 86400000).toISOString().slice(0, 10),
        },
      });
      tasks++;
    } catch (e) {
      report.notes.push(`task ${i}: ${e.message}`);
    }
  }
  report.counts.tasks = tasks;

  let invoices = 0;
  for (let i = 0; i < Math.min(8, clientIds.length); i++) {
    try {
      await api("POST", "/api/v1/invoices/", {
        cookie,
        body: {
          client_id: clientIds[i],
          issue_date: now.toISOString().slice(0, 10),
          due_date: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
          po_number: `INV-DEMO-${i + 1}`,
        },
      });
      invoices++;
    } catch (e) {
      report.notes.push(`invoice ${i}: ${e.message}`);
    }
  }
  report.counts.invoices = invoices;

  report.notes.push(
    "Worker portal logins: the product UI/API only supports staff invite (email). Employee records were created; portal usernames must be provisioned server-side (no frontend door yet). Use staff accounts for UI testing.",
  );

  console.log("\n=== SEED REPORT ===");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
