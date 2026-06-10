// Shared primitives for the workspace API modules. The org role vocabulary
// is the system users.role column (admin|member) — distinct from the
// workspace role set (wsadmin/pm/ba/qa/dev) in mock-data's WsRoleKey.
export type OrgRole = "admin" | "member";
