import type { Metadata } from "next";
import { getTutorEscalations } from "../../../db/tutor";
import { requireCreatorUser } from "../../creator-auth";
import { CapiCoachSupportClient } from "./CapiCoachSupportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Capi Coach support | Creator Studio",
  description: "Review questions that Capi Coach has escalated for teacher guidance.",
};

export default async function CapiCoachSupportPage() {
  const user = await requireCreatorUser("/creator/capi-coach", "classes");
  return <CapiCoachSupportClient userName={user.displayName} initialEscalations={await getTutorEscalations()} />;
}
