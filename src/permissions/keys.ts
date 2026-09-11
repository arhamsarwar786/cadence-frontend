/**
 * The permission catalog, byte-matched to /cadence-permissions.txt (and
 * mirrored at Backend/accounts/permissions-catalog.txt — the backend pins
 * the two equal; this file must track the same source, key for key).
 *
 * Values are the literal catalog keys the API's grants array and every
 * 403 ("missing permission: <key>") name. Never invent a key here that
 * isn't in the catalog — has-perm.ts only ever compares against what a
 * session actually holds.
 */
export const PERM = {
  // 1. Administration & access control
  ADMIN_USERS_VIEW: "admin.users.view",
  ADMIN_USERS_CREATE: "admin.users.create",
  ADMIN_USERS_EDIT: "admin.users.edit",
  ADMIN_USERS_DEACTIVATE: "admin.users.deactivate",
  ADMIN_USERS_RESET_CREDENTIALS: "admin.users.reset_credentials",
  ADMIN_PERMISSIONS_VIEW: "admin.permissions.view",
  ADMIN_PERMISSIONS_MANAGE: "admin.permissions.manage",
  ADMIN_INTEGRATIONS_MANAGE: "admin.integrations.manage",

  // 2. Compliance, logs & data lifecycle
  AUDIT_LOG_VIEW: "audit.log.view",

  // 3. Sensitive / encrypted data (PIPEDA)
  PII_SIN_VIEW_MASKED: "pii.sin.view_masked",
  PII_SIN_VIEW_FULL: "pii.sin.view_full",
  PII_SIN_EDIT: "pii.sin.edit",
  PII_DOB_VIEW_MASKED: "pii.dob.view_masked",
  PII_DOB_VIEW_FULL: "pii.dob.view_full",
  PII_DOB_EDIT: "pii.dob.edit",
  PII_GOVID_VIEW: "pii.govid.view",
  PII_GOVID_EDIT: "pii.govid.edit",
  PII_GOVID_DOWNLOAD: "pii.govid.download",
  PII_BANKING_VIEW_MASKED: "pii.banking.view_masked",
  PII_BANKING_VIEW_FULL: "pii.banking.view_full",
  PII_BANKING_EDIT: "pii.banking.edit",
  PII_BULK_EXPORT: "pii.bulk_export",

  // 4. Clients
  CLIENTS_VIEW: "clients.view",
  CLIENTS_CREATE: "clients.create",
  CLIENTS_EDIT: "clients.edit",
  CLIENTS_DELETE: "clients.delete",
  CLIENTS_CONTACTS_MANAGE: "clients.contacts.manage",
  CLIENTS_MARKUP_VIEW: "clients.markup.view",
  CLIENTS_MARKUP_EDIT: "clients.markup.edit",
  CLIENTS_EXPORT: "clients.export",

  // 5. Workers (candidates & employees)
  WORKERS_VIEW: "workers.view",
  WORKERS_CREATE: "workers.create",
  WORKERS_EDIT: "workers.edit",
  WORKERS_DEACTIVATE: "workers.deactivate",
  WORKERS_ONBOARDING_APPROVE: "workers.onboarding.approve",
  WORKERS_PROFILE_MANAGE: "workers.profile.manage",
  WORKERS_RATINGS_VIEW: "workers.ratings.view",
  WORKERS_PERFORMANCE_EDIT: "workers.performance.edit",
  WORKERS_BACKGROUND_CHECK_VIEW: "workers.background_check.view",
  WORKERS_BACKGROUND_CHECK_EDIT: "workers.background_check.edit",

  // 6. Jobs & scheduling
  JOBS_VIEW: "jobs.view",
  JOBS_CREATE: "jobs.create",
  JOBS_EDIT: "jobs.edit",
  JOBS_CANCEL: "jobs.cancel",
  JOBS_BILL_RATE_VIEW: "jobs.bill_rate.view",
  JOBS_BILL_RATE_EDIT: "jobs.bill_rate.edit",
  JOBS_ASSIGN: "jobs.assign",
  JOBS_CLIENT_NOTIFY: "jobs.client_notify",
  SHIFTS_VIEW: "shifts.view",
  SHIFTS_EDIT: "shifts.edit",
  /** Seeded and grantable but enforced NOWHERE — hoursheets.approve is the
   * real gate for worked hours (ARCHITECTURE.md §5.1). Never branch UI on
   * this key alone. */
  SHIFTS_APPROVE: "shifts.approve",
  HOURSHEETS_VIEW: "hoursheets.view",
  HOURSHEETS_EDIT: "hoursheets.edit",
  HOURSHEETS_APPROVE: "hoursheets.approve",

  // 7. Payroll
  PAYROLL_PAGE_VIEW: "payroll.page.view",
  PAYROLL_RUN: "payroll.run",
  PAYROLL_PAYSLIPS_VIEW: "payroll.payslips.view",
  PAYROLL_PAYSLIPS_EDIT: "payroll.payslips.edit",
  PAYROLL_APPROVE: "payroll.approve",
  PAYROLL_RELEASE: "payroll.release",
  PAYROLL_PAYSLIPS_GENERATE: "payroll.payslips.generate",
  PAYROLL_EXPORT: "payroll.export",

  // 8. Invoicing
  CLIENTS_INVOICE_CREATE: "clients.invoice.create",
  CLIENTS_INVOICE_EDIT: "clients.invoice.edit",
  CLIENTS_INVOICE_APPROVE: "clients.invoice.approve",
  INVOICES_SEND: "invoices.send",
  INVOICES_MARK_PAID: "invoices.mark_paid",
  INVOICES_EXPORT: "invoices.export",

  // 9. Email & AI intake — [P2], modelled only, no UI
  EMAIL_INBOX_ACCESS: "email.inbox.access",
  EMAIL_VIEW: "email.view",
  EMAIL_SEND: "email.send",
  EMAIL_AI_INTAKE_USE: "email.ai_intake.use",
  EMAIL_ACCOUNTS_MANAGE: "email.accounts.manage",

  // 10. E-signatures & documents
  ESIGN_REQUEST_SEND: "esign.request.send",
  ESIGN_STATUS_VIEW: "esign.status.view",
  ESIGN_TEMPLATES_MANAGE: "esign.templates.manage",
  DOCUMENTS_VIEW: "documents.view",
  DOCUMENTS_UPLOAD: "documents.upload",
  DOCUMENTS_DOWNLOAD: "documents.download",
  DOCUMENTS_DELETE: "documents.delete",

  // 11. Notifications
  NOTIFICATIONS_SEND: "notifications.send",
  NOTIFICATIONS_TEMPLATES_MANAGE: "notifications.templates.manage",

  // 12. Privacy & PIPEDA rights
  PRIVACY_REQUESTS_VIEW: "privacy.requests.view",
  PRIVACY_REQUESTS_MANAGE: "privacy.requests.manage",
  PRIVACY_EXPORT: "privacy.export",

  // 13. Tasks
  TASKS_VIEW: "tasks.view",
  TASKS_CREATE: "tasks.create",
  TASKS_EDIT: "tasks.edit",
  TASKS_COMPLETE: "tasks.complete",
  TASKS_DELETE: "tasks.delete",
  TASKS_ASSIGN: "tasks.assign",

  // 14. Reporting — catalog only, no dashboard in first build
  REPORTS_DASHBOARD_VIEW: "reports.dashboard.view",

  // 15. Candidate data migration
  CANDIDATE_IMPORTS_CREATE: "candidate_imports.create",
  CANDIDATE_IMPORTS_VIEW: "candidate_imports.view",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];
