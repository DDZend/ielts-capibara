export const CREATOR_PERMISSIONS = ["content", "classes", "memberships", "mocks"] as const;

export type CreatorPermission = (typeof CREATOR_PERMISSIONS)[number];
export type StaffRole = "owner" | "teacher";
export type StaffStatus = "active" | "inactive" | "invited";

export const CREATOR_PERMISSION_DETAILS: Record<CreatorPermission, { label: string; description: string }> = {
  content: { label: "Course content", description: "Create, upload, reorder, publish, and hide lessons." },
  classes: { label: "Students & classes", description: "Manage students, cohorts, meetings, homework, and attendance." },
  memberships: { label: "Memberships", description: "View and manage packages, payments, access, and promotions." },
  mocks: { label: "Mock tests", description: "Build exams, review attempts, and moderate AI scores." },
};

export const DEFAULT_TEACHER_PERMISSIONS: CreatorPermission[] = ["content", "classes", "mocks"];

export function parsePermissions(value: unknown): CreatorPermission[] {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  const allowed = new Set<string>(CREATOR_PERMISSIONS);
  return [...new Set(candidate.filter((item): item is CreatorPermission => typeof item === "string" && allowed.has(item)))];
}

export function permissionsForRole(role: StaffRole, value: unknown): CreatorPermission[] {
  return role === "owner" ? [...CREATOR_PERMISSIONS] : parsePermissions(value);
}
