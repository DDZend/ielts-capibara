import type { Metadata } from "next";
import { getCommunicationSnapshot } from "../../../db/notifications";
import { requireCreatorUser } from "../../creator-auth";
import { CommunicationsClient } from "./CommunicationsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Communications | Creator Studio",
  description: "Send announcements and monitor automated IELTS Mastery notifications and email delivery.",
};

export default async function CommunicationsPage() {
  const user = await requireCreatorUser("/creator/communications", "classes");
  return <CommunicationsClient userName={user.displayName} initialSnapshot={await getCommunicationSnapshot()} />;
}
