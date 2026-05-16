import type { EnterpriseSetting, Role, RolePermission } from "@/lib/types";

export type PermissionKey =
  | "dashboard.view"
  | "merchants.view"
  | "merchants.create"
  | "merchants.delete"
  | "opportunities.view"
  | "tasks.view"
  | "tasks.manage"
  | "teams.view"
  | "teams.manage"
  | "recruitment.view"
  | "recruitment.manage"
  | "agent_onboarding.view"
  | "agent_onboarding.manage"
  | "merchant_onboarding.view"
  | "merchant_onboarding.manage"
  | "documents.view"
  | "documents.upload"
  | "documents.signature_send"
  | "analytics.view"
  | "reports.view"
  | "residuals.import"
  | "finance.export"
  | "compensation.view"
  | "compensation.manage"
  | "payroll.export"
  | "payroll.integrations"
  | "copilot.use"
  | "copilot.confirm_actions"
  | "messages.view"
  | "notifications.view"
  | "settings.view"
  | "processor_connections.manage"
  | "processor_pricing.manage"
  | "settings.manage_users"
  | "settings.manage_access"
  | "underwriting.manage"
  | "system_activity.view"
  | "audit_logs.view"
  | "api.integrations"
  | "data.export";

export type PermissionCatalogItem = {
  key: PermissionKey;
  label: string;
  description: string;
  category: "Core CRM" | "Growth Workflows" | "Documents & AI" | "Administration";
  navHref?: string;
  critical?: boolean;
  adminOnly?: boolean;
};

export const permissionCatalog: PermissionCatalogItem[] = [
  { key: "dashboard.view", label: "Dashboard", description: "View CRM dashboard and executive widgets.", category: "Core CRM", navHref: "/dashboard", critical: true },
  { key: "merchants.view", label: "Merchant book", description: "View assigned merchant records and profiles.", category: "Core CRM", navHref: "/merchants", critical: true },
  { key: "merchants.create", label: "Create merchants", description: "Add new merchants and opportunities.", category: "Core CRM" },
  { key: "merchants.delete", label: "Delete merchants", description: "Remove merchant records and related files.", category: "Core CRM" },
  { key: "opportunities.view", label: "Opportunities", description: "Open sales pipeline and approval queues.", category: "Core CRM", navHref: "/opportunities" },
  { key: "tasks.view", label: "Tasks", description: "View task and follow-up center.", category: "Core CRM", navHref: "/tasks" },
  { key: "tasks.manage", label: "Manage tasks", description: "Create, assign, and complete workflow tasks.", category: "Core CRM" },
  { key: "teams.view", label: "Teams", description: "View team roster, recruit progress, and team performance.", category: "Growth Workflows", navHref: "/teams" },
  { key: "teams.manage", label: "Manage teams", description: "Assign recruits and update team progress.", category: "Growth Workflows" },
  { key: "recruitment.view", label: "Recruitment", description: "View agent recruiting pipeline.", category: "Growth Workflows", navHref: "/recruitment" },
  { key: "recruitment.manage", label: "Manage recruits", description: "Create recruits, notes, and follow-ups.", category: "Growth Workflows" },
  { key: "agent_onboarding.view", label: "Agent onboarding", description: "View agent onboarding queue and checklist.", category: "Growth Workflows", navHref: "/agent-onboarding" },
  { key: "agent_onboarding.manage", label: "Manage agent onboarding", description: "Update onboarding status, checklist, and approvals.", category: "Growth Workflows" },
  { key: "merchant_onboarding.view", label: "Merchant onboarding", description: "View merchant application workflow.", category: "Growth Workflows", navHref: "/merchant-onboarding" },
  { key: "merchant_onboarding.manage", label: "Manage merchant onboarding", description: "Create merchant applications and update checklist progress.", category: "Growth Workflows" },
  { key: "documents.view", label: "Documents", description: "View uploaded documents and signature tracker.", category: "Documents & AI", navHref: "/documents" },
  { key: "documents.upload", label: "Upload documents", description: "Upload merchant files to private storage.", category: "Documents & AI" },
  { key: "documents.signature_send", label: "Send signatures", description: "Send and update signature requests.", category: "Documents & AI" },
  { key: "analytics.view", label: "Analytics", description: "View interactive workflow analytics.", category: "Documents & AI", navHref: "/analytics" },
  { key: "reports.view", label: "Reports", description: "View business reporting and residual summaries.", category: "Documents & AI", navHref: "/reports" },
  { key: "residuals.import", label: "Residual imports", description: "Import processor residual reports.", category: "Documents & AI" },
  { key: "finance.export", label: "Financial exports", description: "Export CPA-ready accounting files and financial totals.", category: "Documents & AI", adminOnly: true },
  { key: "compensation.view", label: "Compensation", description: "View compensation and override calculations.", category: "Documents & AI", navHref: "/compensation" },
  { key: "compensation.manage", label: "Manage compensation", description: "Manage compensation rules and exceptions.", category: "Documents & AI" },
  { key: "payroll.export", label: "Payroll exports", description: "Generate payroll-ready payout files.", category: "Documents & AI", adminOnly: true },
  { key: "payroll.integrations", label: "Payroll integrations", description: "Connect payroll/payout providers such as Stripe.", category: "Documents & AI", adminOnly: true },
  { key: "copilot.use", label: "Copilot", description: "Use the AI copilot and global chat widget.", category: "Documents & AI", navHref: "/copilot" },
  { key: "copilot.confirm_actions", label: "Confirm Copilot actions", description: "Approve Copilot-suggested CRM writes.", category: "Documents & AI" },
  { key: "messages.view", label: "Messages", description: "View Copilot/message history.", category: "Core CRM", navHref: "/messages" },
  { key: "notifications.view", label: "Notifications", description: "View CRM notifications and delivery logs.", category: "Core CRM", navHref: "/notifications" },
  { key: "settings.view", label: "Settings", description: "Open personal and enterprise settings workspace.", category: "Administration", navHref: "/settings", critical: true },
  { key: "processor_connections.manage", label: "Processor connections", description: "Connect and sync processor/provider accounts for assigned books.", category: "Administration" },
  { key: "processor_pricing.manage", label: "Processor pricing", description: "Manage processor cost rates used in margins, residuals, exports, and compensation.", category: "Administration", adminOnly: true },
  { key: "settings.manage_users", label: "Manage users", description: "Create users, assign managers, and reassign books.", category: "Administration", adminOnly: true },
  { key: "settings.manage_access", label: "Manage access", description: "Change role permissions and enterprise policy controls.", category: "Administration", critical: true, adminOnly: true },
  { key: "underwriting.manage", label: "Underwriting rules", description: "Configure automatic approval, denial, and manual review guidelines.", category: "Administration", adminOnly: true },
  { key: "system_activity.view", label: "System activity", description: "View agent presence, provider connection status, sync events, and system errors.", category: "Administration", adminOnly: true },
  { key: "audit_logs.view", label: "Audit logs", description: "View sensitive action audit history.", category: "Administration" },
  { key: "api.integrations", label: "API integrations", description: "Allow external API integrations and API key access.", category: "Administration", adminOnly: true },
  { key: "data.export", label: "Data export", description: "Export CSVs and operational data.", category: "Administration" },
];

export const permissionCategories = ["Core CRM", "Growth Workflows", "Documents & AI", "Administration"] as const;

export const defaultRolePermissionMatrix: Record<Role, Record<PermissionKey, boolean>> = {
  agent: {
    "dashboard.view": true,
    "merchants.view": true,
    "merchants.create": true,
    "merchants.delete": false,
    "opportunities.view": true,
    "tasks.view": true,
    "tasks.manage": true,
    "teams.view": true,
    "teams.manage": true,
    "recruitment.view": true,
    "recruitment.manage": true,
    "agent_onboarding.view": false,
    "agent_onboarding.manage": false,
    "merchant_onboarding.view": true,
    "merchant_onboarding.manage": true,
    "documents.view": true,
    "documents.upload": true,
    "documents.signature_send": true,
    "analytics.view": true,
    "reports.view": true,
    "residuals.import": false,
    "finance.export": false,
    "compensation.view": true,
    "compensation.manage": false,
    "payroll.export": false,
    "payroll.integrations": false,
    "copilot.use": true,
    "copilot.confirm_actions": true,
    "messages.view": true,
    "notifications.view": true,
    "settings.view": true,
    "processor_connections.manage": true,
    "processor_pricing.manage": false,
    "settings.manage_users": false,
    "settings.manage_access": false,
    "underwriting.manage": false,
    "system_activity.view": false,
    "audit_logs.view": false,
    "api.integrations": false,
    "data.export": true,
  },
  manager: {
    "dashboard.view": true,
    "merchants.view": true,
    "merchants.create": true,
    "merchants.delete": true,
    "opportunities.view": true,
    "tasks.view": true,
    "tasks.manage": true,
    "teams.view": true,
    "teams.manage": true,
    "recruitment.view": true,
    "recruitment.manage": true,
    "agent_onboarding.view": true,
    "agent_onboarding.manage": true,
    "merchant_onboarding.view": true,
    "merchant_onboarding.manage": true,
    "documents.view": true,
    "documents.upload": true,
    "documents.signature_send": true,
    "analytics.view": true,
    "reports.view": true,
    "residuals.import": false,
    "finance.export": false,
    "compensation.view": true,
    "compensation.manage": false,
    "payroll.export": false,
    "payroll.integrations": false,
    "copilot.use": true,
    "copilot.confirm_actions": true,
    "messages.view": true,
    "notifications.view": true,
    "settings.view": true,
    "processor_connections.manage": true,
    "processor_pricing.manage": false,
    "settings.manage_users": false,
    "settings.manage_access": false,
    "underwriting.manage": false,
    "system_activity.view": false,
    "audit_logs.view": true,
    "api.integrations": false,
    "data.export": true,
  },
  admin: Object.fromEntries(permissionCatalog.map((item) => [item.key, true])) as Record<PermissionKey, boolean>,
};

export const enterpriseSettingDefaults: EnterpriseSetting[] = [
  {
    setting_key: "require_mfa_for_admins",
    setting_value: { enabled: true },
    description: "Require multi-factor authentication for admins and managers.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "restrict_exports_to_leadership",
    setting_value: { enabled: true },
    description: "Limit CSV/data exports to managers and admins.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "audit_sensitive_actions",
    setting_value: { enabled: true },
    description: "Keep audit logs for pricing approvals, user changes, exports, and Copilot actions.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "api_access_enabled",
    setting_value: { enabled: false },
    description: "Allow external API integrations using MerchantDesk API keys.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "processor_sync_enabled",
    setting_value: { enabled: true },
    description: "Allow encrypted processor/provider account connections and manual sync runs.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "underwriting_auto_decisions_enabled",
    setting_value: { enabled: true },
    description: "Allow underwriting rules to automatically approve, decline, or route applications to manual review.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "team_recruit_limit",
    setting_value: { limit: 4 },
    description: "Maximum direct recruits per team before admin override is required.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "payroll_exports_enabled",
    setting_value: { enabled: true },
    description: "Allow admins to generate payroll-ready commission and adjustment exports.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "copilot_learning_enabled",
    setting_value: { enabled: true },
    description: "Allow Copilot to retain non-secret company knowledge from conversations and confirmed actions.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "copilot_model",
    setting_value: { model: "gpt-5.4", reasoning: "medium" },
    description: "Default OpenAI model and reasoning profile used by MerchantDesk Copilot.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "copilot_memory_export_enabled",
    setting_value: { enabled: true },
    description: "Allow admins to export retained Copilot memory for portability and vendor migration.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "session_timeout_minutes",
    setting_value: { minutes: 60 },
    description: "Target idle session timeout policy for enterprise SSO/Auth configuration.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
  {
    setting_key: "data_retention_years",
    setting_value: { years: 7 },
    description: "Operational data retention target for backups, exports, and audit review.",
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  },
];

export function defaultRolePermissions(): RolePermission[] {
  const timestamp = new Date(0).toISOString();
  return (Object.keys(defaultRolePermissionMatrix) as Role[]).flatMap((role) =>
    permissionCatalog.map((permission) => ({
      id: `${role}:${permission.key}`,
      role,
      permission_key: permission.key,
      enabled: defaultRolePermissionMatrix[role][permission.key],
      updated_by: null,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );
}

export function hydrateRolePermissions(rows: RolePermission[]) {
  const rowMap = new Map(rows.map((row) => [`${row.role}:${row.permission_key}`, row]));
  return defaultRolePermissions().map((fallback) => rowMap.get(`${fallback.role}:${fallback.permission_key}`) ?? fallback);
}

export function hydrateEnterpriseSettings(rows: EnterpriseSetting[]) {
  const rowMap = new Map(rows.map((row) => [row.setting_key, row]));
  return enterpriseSettingDefaults.map((fallback) => rowMap.get(fallback.setting_key) ?? fallback);
}

export function hasPermission(role: Role, rows: RolePermission[], permissionKey: PermissionKey) {
  const hydrated = hydrateRolePermissions(rows);
  return hydrated.find((row) => row.role === role && row.permission_key === permissionKey)?.enabled ?? false;
}

export function permissionForHref(href: string): PermissionKey | null {
  const match = permissionCatalog
    .filter((item) => item.navHref)
    .sort((a, b) => (b.navHref?.length ?? 0) - (a.navHref?.length ?? 0))
    .find((item) => href === item.navHref || href.startsWith(`${item.navHref}/`));

  return match?.key ?? null;
}
