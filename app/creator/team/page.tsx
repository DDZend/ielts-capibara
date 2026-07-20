import type { Metadata } from "next";
import { getTeamAdminSnapshot } from "../../../db/staff";
import { requireOwnerUser } from "../../creator-auth";
import { TeacherTeamClient } from "./TeacherTeamClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teacher team | Creator Studio",
  description: "Invite teachers and control private IELTS Mastery workspace permissions.",
};

export default async function TeacherTeamPage() {
  const user = await requireOwnerUser("/creator/team");
  return <TeacherTeamClient userName={user.displayName} initialSnapshot={await getTeamAdminSnapshot()} />;
}
