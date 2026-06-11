import type { OrgRoleKey, WsRoleKey } from "./workspace-roles";

// Role definitions and avatar helpers are real (non-mock) and now live in
// workspace-roles.ts; re-exported here so existing importers keep working.
export {
  ORG_ROLES,
  WS_ROLES,
  avatarStyle,
  avatarStyleSolid,
  initials,
} from "./workspace-roles";
export type { OrgRoleKey, WsRoleKey, RoleDef } from "./workspace-roles";

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

export type ProviderScope = "org" | "select";
export type Provider = {
  id: string;
  providerKey: string;
  name: string;
  keyLabel: string;
  icon: string;
  status: "connected" | "local" | "disabled";
  masked: string;
  host: string;
  model: string;
  usage: number;
  scope: ProviderScope;
};

export type ProviderCatalogEntry = {
  key: string;
  name: string;
  icon: string;
  type: "api" | "local";
  models: string[];
  host: string;
  keyHint?: string;
  docs?: string;
  endpointPlaceholder?: string;
};

// Known providers users can add. Models listed are the supported set
// shown in the picker; users select a subset to register for the org.
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    key: "openai", name: "OpenAI", icon: "sparkles", type: "api",
    host: "https://api.openai.com/v1", keyHint: "sk-...", docs: "platform.openai.com",
    models: ["gpt-5", "gpt-4o", "gpt-4o-mini", "o3-mini", "o1"],
  },
  {
    key: "anthropic", name: "Anthropic", icon: "bot", type: "api",
    host: "https://api.anthropic.com", keyHint: "sk-ant-...", docs: "console.anthropic.com",
    models: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4"],
  },
  {
    key: "google", name: "Google Gemini", icon: "sparkles", type: "api",
    host: "https://generativelanguage.googleapis.com", keyHint: "AIza...", docs: "aistudio.google.com",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    key: "minimax", name: "MiniMax", icon: "zap", type: "api",
    host: "https://api.minimax.chat/v1", keyHint: "mx-...", docs: "platform.minimaxi.com",
    models: ["abab6.5", "abab6.5-chat"],
  },
  {
    key: "ollama", name: "Ollama", icon: "hard-drive", type: "local",
    host: "http://localhost:11434", docs: "ollama.com",
    endpointPlaceholder: "http://localhost:11434",
    models: ["ollama/gemma3:4b", "ollama/llama3.1:8b", "ollama/qwen2.5:7b", "ollama/mistral:7b"],
  },
];

export function catalogByKey(key: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key);
}

const PROVIDER_SEED: Provider[] = [
  { id: "p_openai", providerKey: "openai", name: "OpenAI", keyLabel: "key1", icon: "sparkles", status: "connected", masked: "sk-•••••••••••••••• a91f", host: "https://api.openai.com/v1", model: "gpt-5", usage: 61, scope: "org" },
  { id: "p_anthropic", providerKey: "anthropic", name: "Anthropic", keyLabel: "key2", icon: "bot", status: "connected", masked: "sk-ant-•••••••••• 7c2d", host: "https://api.anthropic.com", model: "claude-sonnet-4", usage: 34, scope: "org" },
  { id: "p_ollama", providerKey: "ollama", name: "Ollama", keyLabel: "local", icon: "hard-drive", status: "local", masked: "http://100.107.85.81:11434", host: "http://100.107.85.81:11434", model: "ollama/gemma3:4b", usage: 5, scope: "org" },
];

// The providers screen now reads from the real API (see lib/providers-api.ts);
// this seed only feeds the overview and chat screens that still mock providers.
export const PROVIDERS: Provider[] = PROVIDER_SEED;

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

// Past chat sessions surfaced in the left-side history rail. Grouped by
// the human-readable `group` bucket so the UI does not re-compute dates.
export type Conversation = {
  id: string;
  title: string;
  preview: string;
  updatedLabel: string;
  group: "Hôm nay" | "Hôm qua" | "7 ngày qua" | "Cũ hơn";
  msgCount: number;
  model: string;
  templateId?: string;
};

export const CONVERSATIONS: Conversation[] = [
  { id: "c1", title: "Review PR #482 — refactor auth", preview: "Diff có 12 file. Tập trung vào session token storage…", updatedLabel: "10:42", group: "Hôm nay", msgCount: 14, model: "claude-sonnet-4", templateId: "t1" },
  { id: "c2", title: "User story: cổng thanh toán", preview: "Là khách hàng, tôi muốn lưu thẻ để…", updatedLabel: "09:15", group: "Hôm nay", msgCount: 6, model: "gpt-5", templateId: "t2" },
  { id: "c3", title: "Test case xuất hoá đơn", preview: "Happy path: hoá đơn VND với VAT 8%…", updatedLabel: "Hôm qua, 17:02", group: "Hôm qua", msgCount: 22, model: "claude-sonnet-4", templateId: "t3" },
  { id: "c4", title: "Tóm tắt standup nhóm Banking", preview: "3 chặn, 2 hoàn thành, sprint 24…", updatedLabel: "Hôm qua, 09:30", group: "Hôm qua", msgCount: 4, model: "gpt-4o", templateId: "t4" },
  { id: "c5", title: "Phản hồi khiếu nại giao hàng trễ", preview: "Soạn email xin lỗi, đề xuất voucher 10%…", updatedLabel: "T4", group: "7 ngày qua", msgCount: 8, model: "claude-opus-4", templateId: "t6" },
  { id: "c6", title: "Giải thích query JOIN 3 bảng", preview: "Truy vấn này lấy đơn + khách + sản phẩm…", updatedLabel: "T2", group: "7 ngày qua", msgCount: 11, model: "ollama/gemma3:4b", templateId: "t7" },
  { id: "c7", title: "Ma trận RACI dự án ECOM", preview: "Stakeholder: PM, BA, QA, Dev, Ops…", updatedLabel: "25/05", group: "Cũ hơn", msgCount: 17, model: "gpt-5", templateId: "t9" },
  { id: "c8", title: "Phân tích đối thủ Shopee vs Lazada", preview: "Khung 5 trục: giá, vận hành, marketing…", updatedLabel: "22/05", group: "Cũ hơn", msgCount: 9, model: "claude-sonnet-4", templateId: "t11" },
];

export function userById(uid: string): User | undefined {
  return USERS.find((u) => u.id === uid);
}

export type Membership = { ws: Workspace; roles: WsRoleKey[] };

export function membershipsOf(uid: string): Membership[] {
  return WORKSPACES.flatMap((ws) => {
    const m = ws.members.find((mm) => mm.uid === uid);
    return m ? [{ ws, roles: m.roles }] : [];
  });
}
