import { env } from "cloudflare:workers";
import { ensureAppSchema, getD1 } from "./index";
import {
  CREATOR_PERMISSIONS,
  DEFAULT_TEACHER_PERMISSIONS,
  parsePermissions,
  permissionsForRole,
  type CreatorPermission,
  type StaffRole,
  type StaffStatus,
} from "../lib/staff-roles";

type StaffRow = {
  id: number;
  email: string;
  display_name: string;
  role: StaffRole;
  status: StaffStatus;
  permissions_json: string;
  invited_by: string;
  invited_at: string;
  activated_at: string | null;
  last_signed_in_at: string | null;
  created_at: string;
  updated_at: string;
};

type AccessRequestRow = {
  id: number;
  email: string;
  display_name: string;
  message: string;
  status: "pending" | "approved" | "declined";
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type StaffAccess = {
  id: number;
  email: string;
  displayName: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: CreatorPermission[];
  invitedBy: string;
  invitedAt: string;
  activatedAt: string | null;
  lastSignedInAt: string | null;
};

export type TeacherAccessRequest = {
  id: number;
  email: string;
  displayName: string;
  message: string;
  status: "pending" | "approved" | "declined";
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanDisplayName(value: string | null | undefined, email: string) {
  const cleaned = value?.trim().slice(0, 100);
  return cleaned || email.split("@")[0] || email;
}

function toAccess(row: StaffRow): StaffAccess {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    permissions: permissionsForRole(row.role, row.permissions_json),
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    activatedAt: row.activated_at,
    lastSignedInAt: row.last_signed_in_at,
  };
}

function toRequest(row: AccessRequestRow): TeacherAccessRequest {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    message: row.message,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

async function bootstrapConfiguredStaff() {
  await ensureAppSchema();
  const values = env as unknown as Record<string, string | undefined>;
  const configured = (values.TEACHER_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  const ownerEmail = normalizeEmail(values.OWNER_EMAIL ?? configured[0] ?? "");
  const emails = [...new Set([ownerEmail, ...configured].filter(Boolean))];
  if (emails.length === 0) return;

  const now = new Date().toISOString();
  const statements = emails.flatMap((email) => {
    const role: StaffRole = email === ownerEmail ? "owner" : "teacher";
    const permissions = role === "owner" ? CREATOR_PERMISSIONS : DEFAULT_TEACHER_PERMISSIONS;
    const displayName = cleanDisplayName(null, email);
    return [
      getD1().prepare(`INSERT OR IGNORE INTO staff_roles
        (email, display_name, role, status, permissions_json, invited_by, invited_at, activated_at, last_signed_in_at, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, 'system migration', ?, ?, NULL, ?, ?)`)
        .bind(email, displayName, role, JSON.stringify(permissions), now, now, now, now),
      getD1().prepare(`INSERT OR IGNORE INTO teacher_profiles
        (email, display_name, timezone, color, active, created_at, updated_at)
        VALUES (?, ?, 'Asia/Almaty', '#16803e', 1, ?, ?)`)
        .bind(email, displayName, now, now),
    ];
  });
  await getD1().batch(statements);
}

export async function getStaffAccess(email: string, displayName?: string | null): Promise<StaffAccess | null> {
  await bootstrapConfiguredStaff();
  const normalized = normalizeEmail(email);
  let row = await getD1().prepare("SELECT * FROM staff_roles WHERE email = ? LIMIT 1").bind(normalized).first<StaffRow>();
  if (!row) return null;

  const now = new Date().toISOString();
  const name = displayName ? cleanDisplayName(displayName, normalized) : row.display_name;
  if (row.status === "invited") {
    await getD1().batch([
      getD1().prepare(`UPDATE staff_roles SET status = 'active', display_name = ?, activated_at = ?, last_signed_in_at = ?, updated_at = ? WHERE id = ?`)
        .bind(name, now, now, now, row.id),
      getD1().prepare(`INSERT INTO teacher_profiles (email, display_name, timezone, color, active, created_at, updated_at)
        VALUES (?, ?, 'Asia/Almaty', '#16803e', 1, ?, ?)
        ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, active = 1, updated_at = excluded.updated_at`)
        .bind(normalized, name, now, now),
      getD1().prepare(`UPDATE teacher_access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE email = ?`)
        .bind(row.invited_by, now, normalized),
    ]);
    row = await getD1().prepare("SELECT * FROM staff_roles WHERE id = ? LIMIT 1").bind(row.id).first<StaffRow>();
  } else if (row.status === "active") {
    await getD1().prepare("UPDATE staff_roles SET display_name = ?, last_signed_in_at = ?, updated_at = ? WHERE id = ?")
      .bind(name, now, now, row.id).run();
    row = { ...row, display_name: name, last_signed_in_at: now, updated_at: now };
  }
  return row ? toAccess(row) : null;
}

export function staffHasPermission(staff: StaffAccess | null, permission?: CreatorPermission) {
  return Boolean(staff && staff.status === "active" && (!permission || staff.permissions.includes(permission)));
}

export async function getTeacherAccessRequest(email: string) {
  await ensureAppSchema();
  const row = await getD1().prepare("SELECT * FROM teacher_access_requests WHERE email = ? LIMIT 1")
    .bind(normalizeEmail(email)).first<AccessRequestRow>();
  return row ? toRequest(row) : null;
}

export async function requestTeacherAccess(email: string, displayName: string, message: string) {
  await ensureAppSchema();
  const normalized = normalizeEmail(email);
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO teacher_access_requests
    (email, display_name, message, status, requested_at, reviewed_by, reviewed_at)
    VALUES (?, ?, ?, 'pending', ?, NULL, NULL)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, message = excluded.message,
      status = 'pending', requested_at = excluded.requested_at, reviewed_by = NULL, reviewed_at = NULL`)
    .bind(normalized, cleanDisplayName(displayName, normalized), message.trim().slice(0, 500), now).run();
  return getTeacherAccessRequest(normalized);
}

export async function getTeamAdminSnapshot() {
  await bootstrapConfiguredStaff();
  const [staffResult, requestResult] = await Promise.all([
    getD1().prepare("SELECT * FROM staff_roles ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC").all<StaffRow>(),
    getD1().prepare("SELECT * FROM teacher_access_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, requested_at DESC").all<AccessRequestRow>(),
  ]);
  return {
    staff: (staffResult.results ?? []).map(toAccess),
    requests: (requestResult.results ?? []).map(toRequest),
  };
}

export async function inviteTeacher(input: { email: string; displayName?: string; permissions?: unknown; invitedBy: string }) {
  await bootstrapConfiguredStaff();
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@") || email.length > 254) throw new Error("Enter a valid teacher email address.");
  const existing = await getD1().prepare("SELECT role FROM staff_roles WHERE email = ? LIMIT 1").bind(email).first<{ role: StaffRole }>();
  if (existing?.role === "owner") throw new Error("The owner account cannot be replaced by a teacher invitation.");
  const now = new Date().toISOString();
  const permissions = parsePermissions(input.permissions);
  const selected = permissions.length > 0 ? permissions : DEFAULT_TEACHER_PERMISSIONS;
  await getD1().prepare(`INSERT INTO staff_roles
    (email, display_name, role, status, permissions_json, invited_by, invited_at, activated_at, last_signed_in_at, created_at, updated_at)
    VALUES (?, ?, 'teacher', 'invited', ?, ?, ?, NULL, NULL, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, role = 'teacher', status = 'invited',
      permissions_json = excluded.permissions_json, invited_by = excluded.invited_by, invited_at = excluded.invited_at,
      activated_at = NULL, updated_at = excluded.updated_at`)
    .bind(email, cleanDisplayName(input.displayName, email), JSON.stringify(selected), normalizeEmail(input.invitedBy), now, now, now).run();
  return getTeamAdminSnapshot();
}

export async function updateTeacher(input: { email: string; status?: unknown; permissions?: unknown; updatedBy: string }) {
  await bootstrapConfiguredStaff();
  const email = normalizeEmail(input.email);
  const row = await getD1().prepare("SELECT * FROM staff_roles WHERE email = ? LIMIT 1").bind(email).first<StaffRow>();
  if (!row) throw new Error("Teacher account not found.");
  if (row.role === "owner") throw new Error("The owner account cannot be deactivated or restricted.");
  const status = input.status === "active" || input.status === "inactive" || input.status === "invited" ? input.status : row.status;
  const permissions = input.permissions === undefined ? parsePermissions(row.permissions_json) : parsePermissions(input.permissions);
  const now = new Date().toISOString();
  await getD1().batch([
    getD1().prepare("UPDATE staff_roles SET status = ?, permissions_json = ?, updated_at = ? WHERE email = ?")
      .bind(status, JSON.stringify(permissions), now, email),
    getD1().prepare("UPDATE teacher_profiles SET active = ?, updated_at = ? WHERE email = ?")
      .bind(status === "active" ? 1 : 0, now, email),
  ]);
  return getTeamAdminSnapshot();
}

export async function reviewTeacherRequest(input: { email: string; decision: "approved" | "declined"; reviewedBy: string; permissions?: unknown }) {
  await bootstrapConfiguredStaff();
  const email = normalizeEmail(input.email);
  const request = await getTeacherAccessRequest(email);
  if (!request) throw new Error("Access request not found.");
  const now = new Date().toISOString();
  const reviewer = normalizeEmail(input.reviewedBy);
  if (input.decision === "approved") {
    const permissions = parsePermissions(input.permissions);
    const selected = permissions.length > 0 ? permissions : DEFAULT_TEACHER_PERMISSIONS;
    await getD1().batch([
      getD1().prepare(`INSERT INTO staff_roles
        (email, display_name, role, status, permissions_json, invited_by, invited_at, activated_at, last_signed_in_at, created_at, updated_at)
        VALUES (?, ?, 'teacher', 'invited', ?, ?, ?, NULL, NULL, ?, ?)
        ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, status = 'invited', permissions_json = excluded.permissions_json,
          invited_by = excluded.invited_by, invited_at = excluded.invited_at, updated_at = excluded.updated_at`)
        .bind(email, request.displayName, JSON.stringify(selected), reviewer, now, now, now),
      getD1().prepare("UPDATE teacher_access_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE email = ?")
        .bind(reviewer, now, email),
    ]);
  } else {
    await getD1().prepare("UPDATE teacher_access_requests SET status = 'declined', reviewed_by = ?, reviewed_at = ? WHERE email = ?")
      .bind(reviewer, now, email).run();
  }
  return getTeamAdminSnapshot();
}
