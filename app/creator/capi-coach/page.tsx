import type { Metadata } from "next";
import { getTutorEscalations } from "../../../db/tutor";
import { requireCreatorUser } from "../../creator-auth";
import { CapyCoachSupportClient } from "./CapyCoachSupportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Capy Coach support | Creator Studio",
  description: "Review questions that Capy Coach has escalated for teacher guidance.",
};

export default async function CapyCoachSupportPage() {
  const user = await requireCreatorUser("/creator/capi-coach", "classes");
  return <CapyCoachSupportClient userName={user.displayName} initialEscalations={await getTutorEscalations()} />;
}
