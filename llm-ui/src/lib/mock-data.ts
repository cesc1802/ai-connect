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

export type User = {
  id: string;
  name: string;
  email: string;
  org: OrgRoleKey;
  hue: number;
  status: "active" | "invited";
  lastActive: string;
  tag?: string;
};

export const USERS: User[] = [
  { id: "u_thuoc", name: "Thược", email: "thuoc@abc.vn", org: "owner", hue: 32, status: "active", lastActive: "5 phút trước" },
  { id: "u_nga", name: "Nga", email: "nga.hr@abc.vn", org: "admin", hue: 200, status: "active", lastActive: "1 giờ trước", tag: "HR" },
  { id: "u_minh", name: "Minh", email: "minh@abc.vn", org: "member", hue: 145, status: "active", lastActive: "12 phút trước" },
  { id: "u_lan", name: "Lan", email: "lan@abc.vn", org: "member", hue: 280, status: "active", lastActive: "2 giờ trước" },
  { id: "u_tuan", name: "Tuấn", email: "tuan@abc.vn", org: "member", hue: 12, status: "active", lastActive: "Hôm qua" },
  { id: "u_ha", name: "Hà", email: "ha@abc.vn", org: "member", hue: 95, status: "active", lastActive: "30 phút trước" },
  { id: "u_phong", name: "Phong", email: "phong@abc.vn", org: "member", hue: 250, status: "active", lastActive: "3 giờ trước" },
  { id: "u_mai", name: "Mai", email: "mai@abc.vn", org: "member", hue: 330, status: "active", lastActive: "45 phút trước" },
  { id: "u_kiet", name: "Kiệt", email: "kiet@abc.vn", org: "member", hue: 60, status: "invited", lastActive: "Chưa kích hoạt" },
];

export type WorkspaceMember = { uid: string; roles: WsRoleKey[] };
export type Workspace = {
  id: string;
  name: string;
  key: string;
  hue: number;
  desc: string;
  agents: number;
  sessions: number;
  templates: string[];
  members: WorkspaceMember[];
};

export const WORKSPACES: Workspace[] = [
  {
    id: "ws_ecom", name: "Dự Án E-Commerce", key: "e-commerce", hue: 32,
    desc: "Nền tảng bán hàng đa kênh — web, app, và tích hợp sàn TMĐT.",
    agents: 8, sessions: 142,
    templates: ["t1", "t2", "t3", "t4", "t8", "t11"],
    members: [
      { uid: "u_thuoc", roles: ["wsadmin", "dev"] },
      { uid: "u_minh", roles: ["pm"] },
      { uid: "u_lan", roles: ["ba"] },
      { uid: "u_tuan", roles: ["qa"] },
      { uid: "u_phong", roles: ["dev"] },
    ],
  },
  {
    id: "ws_bank", name: "Dự Án Banking", key: "banking", hue: 200,
    desc: "Hệ thống lõi ngân hàng số — tuân thủ, bảo mật, và đối soát.",
    agents: 5, sessions: 87,
    templates: ["t6", "t9", "t10"],
    members: [
      { uid: "u_thuoc", roles: ["dev"] },
      { uid: "u_ha", roles: ["pm"] },
      { uid: "u_mai", roles: ["ba", "qa"] },
    ],
  },
];

export type Provider = {
  id: string;
  name: string;
  keyLabel: string;
  icon: string;
  status: "connected" | "local";
  masked: string;
  models: string[];
  usage: number;
  scope: "org";
};

export const PROVIDERS: Provider[] = [
  { id: "p_openai", name: "OpenAI", keyLabel: "key1", icon: "sparkles", status: "connected", masked: "sk-•••••••••••••••• a91f", models: ["gpt-5", "gpt-4o", "o3-mini"], usage: 61, scope: "org" },
  { id: "p_anthropic", name: "Anthropic", keyLabel: "key2", icon: "bot", status: "connected", masked: "sk-ant-•••••••••• 7c2d", models: ["claude-opus-4", "claude-sonnet-4"], usage: 34, scope: "org" },
  { id: "p_ollama", name: "Ollama", keyLabel: "local", icon: "hard-drive", status: "local", masked: "http://100.107.85.81:11434", models: ["ollama/gemma3:4b"], usage: 5, scope: "org" },
];

export type Template = {
  id: string;
  title: string;
  cat: string;
  icon: string;
  uses: number;
  author: string;
  desc: string;
};

export const TEMPLATE_CATEGORIES = ["Tất cả", "Kỹ thuật", "Phân tích (BA)", "Kiểm thử (QA)", "Quản lý (PM)", "Marketing", "CSKH", "Dữ liệu"];

export const TEMPLATES: Template[] = [
  { id: "t1", title: "Review Pull Request", cat: "Kỹ thuật", icon: "code", uses: 1240, author: "Thược", desc: "Phân tích diff, gắn cờ rủi ro bảo mật và đề xuất sửa đổi." },
  { id: "t2", title: "Sinh User Story", cat: "Phân tích (BA)", icon: "chart-line", uses: 980, author: "Lan", desc: "Chuyển yêu cầu thô thành user story + tiêu chí chấp nhận." },
  { id: "t3", title: "Test Case từ Spec", cat: "Kiểm thử (QA)", icon: "bug", uses: 870, author: "Tuấn", desc: "Tạo bộ test case (happy / edge / negative) từ đặc tả." },
  { id: "t4", title: "Tóm tắt Standup", cat: "Quản lý (PM)", icon: "briefcase", uses: 760, author: "Minh", desc: "Tổng hợp cập nhật hằng ngày thành bản tóm tắt cho stakeholder." },
  { id: "t5", title: "Mô tả sản phẩm", cat: "Marketing", icon: "sparkles", uses: 642, author: "Nga", desc: "Viết mô tả sản phẩm chuẩn SEO theo tông thương hiệu." },
  { id: "t6", title: "Phản hồi khiếu nại", cat: "CSKH", icon: "message-square", uses: 590, author: "Hà", desc: "Soạn phản hồi đồng cảm, đúng quy trình cho khiếu nại khách hàng." },
  { id: "t7", title: "Giải thích truy vấn SQL", cat: "Dữ liệu", icon: "hash", uses: 480, author: "Phong", desc: "Diễn giải truy vấn phức tạp thành ngôn ngữ tự nhiên." },
  { id: "t8", title: "Refactor an toàn", cat: "Kỹ thuật", icon: "git-branch", uses: 455, author: "Phong", desc: "Đề xuất refactor giữ nguyên hành vi, kèm bước kiểm chứng." },
  { id: "t9", title: "Ma trận RACI", cat: "Quản lý (PM)", icon: "grid-3x3", uses: 432, author: "Minh", desc: "Lập ma trận trách nhiệm cho một sáng kiến nhiều bên." },
  { id: "t10", title: "Kịch bản hồi quy", cat: "Kiểm thử (QA)", icon: "circle-check", uses: 410, author: "Mai", desc: "Lập danh sách hồi quy ưu tiên trước mỗi lần phát hành." },
  { id: "t11", title: "Phân tích đối thủ", cat: "Phân tích (BA)", icon: "chart-line", uses: 388, author: "Lan", desc: "Khung so sánh tính năng và định vị đối thủ cạnh tranh." },
  { id: "t12", title: "Email onboarding", cat: "Marketing", icon: "mail", uses: 351, author: "Nga", desc: "Chuỗi email chào mừng người dùng mới theo từng giai đoạn." },
];

export function userById(uid: string): User | undefined {
  return USERS.find((u) => u.id === uid);
}

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

export type Membership = { ws: Workspace; roles: WsRoleKey[] };

export function membershipsOf(uid: string): Membership[] {
  return WORKSPACES.flatMap((ws) => {
    const m = ws.members.find((mm) => mm.uid === uid);
    return m ? [{ ws, roles: m.roles }] : [];
  });
}
