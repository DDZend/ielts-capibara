import { redirect } from "next/navigation";
import { getStaffAccess, staffHasPermission, type StaffAccess } from "../db/staff";
import type { CreatorPermission } from "../lib/staff-roles";
import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

export type CreatorUser = ChatGPTUser & { staff: StaffAccess };

export async function isCreatorEmail(email: string, permission?: CreatorPermission) {
  const staff = await getStaffAccess(email);
  return staffHasPermission(staff, permission);
}

export async function requireCreatorUser(returnTo = "/creator", permission?: CreatorPermission): Promise<CreatorUser> {
  const user = await requireChatGPTUser(returnTo);
  const staff = await getStaffAccess(user.email, user.displayName);
  if (staffHasPermission(staff, permission) && staff) return { ...user, staff };

  const reason = staff?.status === "inactive" ? "inactive" : staff?.status === "active" ? "permission" : "approval";
  redirect(`/teacher-access?reason=${reason}`);
}

export async function requireOwnerUser(returnTo = "/creator/team"): Promise<CreatorUser> {
  const user = await requireCreatorUser(returnTo);
  if (user.staff.role === "owner") return user;
  redirect("/teacher-access?reason=owner");
}

export async function getApiCreatorUser(permission?: CreatorPermission) {
  const user = await getChatGPTUser();
  if (!user) return { user: null, staff: null, status: 401 as const };
  const staff = await getStaffAccess(user.email, user.displayName);
  if (!staffHasPermission(staff, permission) || !staff) return { user: null, staff, status: 403 as const };
  return { user, staff, status: 200 as const };
}

export async function getApiOwnerUser() {
  const auth = await getApiCreatorUser();
  if (!auth.user || auth.staff?.role !== "owner") return { user: null, staff: auth.staff, status: auth.status === 401 ? 401 as const : 403 as const };
  return auth;
}
