/** Grant bundles from scripts/seed-via-frontend-api.mjs — used only to label
 * seeded demo accounts when the roster API returns masked logins. */
export const DEMO_STAFF_PROFILES = [
  {
    key: "recruiter",
    label: "Recruiter",
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
    label: "Billing",
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
    label: "Payroll",
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
    label: "Compliance",
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
    label: "Read-only",
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
    label: "Scheduler",
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
] as const;

function grantKeySet(keys: readonly string[]): Set<string> {
  return new Set(keys);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

export function matchDemoStaffProfile(grantKeys: string[]) {
  const held = grantKeySet(grantKeys);
  for (const profile of DEMO_STAFF_PROFILES) {
    if (setsEqual(held, grantKeySet(profile.grants))) {
      return profile;
    }
  }
  return null;
}
