export type NavItem = { to: string; label: string; icon: string; end?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const ORG_NAV: NavGroup[] = [
  {
    label: "Làm việc",
    items: [{ to: "/chat", label: "Trò chuyện", icon: "message-square" }],
  },
  {
    label: "Tổ chức",
    items: [
      { to: "/", label: "Tổng quan", icon: "layout-dashboard", end: true },
      { to: "/members", label: "Thành viên", icon: "users" },
      { to: "/workspaces", label: "Workspaces", icon: "layers" },
      { to: "/permissions", label: "Phân quyền", icon: "shield-check" },
      { to: "/matrix", label: "Ma trận truy cập", icon: "grid-3x3" },
    ],
  },
  {
    label: "Tài nguyên",
    items: [
      { to: "/providers", label: "Providers", icon: "cpu" },
      { to: "/templates", label: "Prompt Templates", icon: "scroll-text" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { to: "/billing", label: "Thanh toán", icon: "credit-card" },
      { to: "/settings", label: "Cài đặt", icon: "settings" },
    ],
  },
];
