import type { Metadata } from "next";
import { getTeacherClassSnapshot } from "../../../db/classes";
import { requireCreatorUser } from "../../creator-auth";
import { ClassManagementClient } from "./ClassManagementClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Students & classes | Creator Studio",
  description: "Manage IELTS students, cohorts, teachers, classes, homework and attendance.",
};

export default async function CreatorClassesPage() {
  const user = await requireCreatorUser("/creator/classes");
  return <ClassManagementClient userName={user.displayName} initialSnapshot={await getTeacherClassSnapshot(user.email, user.displayName)} />;
}
