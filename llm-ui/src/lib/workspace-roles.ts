// Real (non-mock) role definitions and avatar helpers shared across screens.
// Extracted from mock-data so screens dropping mock arrays keep role tints.

export type OrgRoleKey = "owner" | "admin" | "member";
export type WsRoleKey = "wsadmin" | "pm" | "ba" | "qa" | "dev";

export type RoleDef = {
  key: string;
  label: string;
  short: string;
  icon: string;
  desc?: string;
  tint: string;
};

export const ORG_ROLES: Record<OrgRoleKey, RoleDef> = {
  owner: { key: "owner", label: "Org Owner", short: "Owner", icon: "crown", desc: "Toàn quyền kiểm soát tổ chức", tint: "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400 dark:bg-amber-500/10" },
  admin: { key: "admin", label: "Org Admin", short: "Admin", icon: "user-cog", desc: "Quản lý người dùng, billing", tint: "bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-400 dark:bg-sky-500/10" },
  member: { key: "member", label: "Org Member", short: "Member", icon: "user", desc: "Nhân viên — truy cập theo workspace", tint: "bg-muted text-muted-foreground border-transparent" },
};

export const WS_ROLES: Record<WsRoleKey, RoleDef> = {
  wsadmin: { key: "wsadmin", label: "Workspace Admin", short: "WS Admin", icon: "shield-check", tint: "bg-primary/12 text-primary border-primary/25 dark:bg-primary/15" },
  pm: { key: "pm", label: "Project Manager", short: "PM", icon: "briefcase", tint: "bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-400 dark:bg-sky-500/10" },
  ba: { key: "ba", label: "Business Analyst", short: "BA", icon: "chart-line", tint: "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400 dark:bg-amber-500/10" },
  qa: { key: "qa", label: "Quality Assurance", short: "QA", icon: "bug", tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/10" },
  dev: { key: "dev", label: "Developer", short: "Dev", icon: "code", tint: "bg-teal-500/15 text-teal-700 border-teal-500/25 dark:text-teal-400 dark:bg-teal-500/10" },
};

export function avatarStyle(hue: number) {
  return { background: `oklch(0.92 0.05 ${hue})`, color: `oklch(0.42 0.12 ${hue})` };
}

export function avatarStyleSolid(hue: number) {
  return { background: `oklch(0.70 0.13 ${hue})`, color: "#fff" };
}

export function initials(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim().split(" ");
  return (clean.length > 1 ? clean[0][0] + clean[clean.length - 1][0] : clean[0].slice(0, 2)).toUpperCase();
}
