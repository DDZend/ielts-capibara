import type { Metadata } from "next";
import { getMembershipAdminSnapshot } from "../../../db/billing";
import { requireCreatorUser } from "../../creator-auth";
import { MembershipAdminClient } from "./MembershipAdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Memberships | Creator Studio",
  description: "Teacher membership, promotion, refund and access controls.",
};

export default async function MembershipsPage() {
  const user = await requireCreatorUser("/creator/memberships");
  return <MembershipAdminClient userName={user.displayName} initialSnapshot={await getMembershipAdminSnapshot()} />;
}
