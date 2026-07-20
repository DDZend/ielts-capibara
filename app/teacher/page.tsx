import { redirect } from "next/navigation";
import { getStaffAccess, staffHasPermission } from "../../db/staff";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function TeacherEntryPage() {
  const user = await requireChatGPTUser("/teacher");
  const staff = await getStaffAccess(user.email, user.displayName);
  if (staffHasPermission(staff) && staff) {
    if (staff.permissions.includes("content")) redirect("/creator");
    if (staff.permissions.includes("classes")) redirect("/creator/classes");
    if (staff.permissions.includes("mocks")) redirect("/creator/mock-tests");
    if (staff.permissions.includes("memberships")) redirect("/creator/memberships");
  }
  const reason = staff?.status === "inactive" ? "inactive" : "approval";
  redirect(`/teacher-access?reason=${reason}`);
}
