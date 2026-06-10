import { hueFromString } from "./slugify";
import type { User } from "./mock-data";
import type { OrgRole } from "./workspace-types";

// Bridges API member/candidate records to the `User` shape the Avatar and
// RoleBadge widgets consume, so the widgets stay untouched. The users table
// stores only a username: both the name line and the email line render the
// username, and the avatar hue is derived deterministically from it.

export interface ApiMemberLike {
  userId: string;
  username: string;
  orgRole: OrgRole;
}

export function apiMemberToUser(m: ApiMemberLike): User {
  return {
    id: m.userId,
    name: m.username,
    email: m.username,
    org: m.orgRole,
    hue: hueFromString(m.username),
    status: "active",
    lastActive: "",
  };
}
