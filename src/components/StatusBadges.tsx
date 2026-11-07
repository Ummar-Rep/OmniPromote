import { useTranslations } from "next-intl";
import type { DealStatus, ProposalStatus } from "@/lib/types";
import { Badge } from "./ui";

const dealTone: Record<DealStatus, "gray" | "gold" | "green" | "red" | "blue"> = {
  awaiting_sponsor_payment: "gold",
  sponsor_paid: "blue",
  proof_uploaded: "blue",
  disputed: "red",
  proof_approved: "blue",
  organizer_paid: "green",
  cancelled: "red",
};
const proposalTone: Record<ProposalStatus, "gray" | "gold" | "green" | "red"> = {
  sent: "gold",
  accepted: "green",
  rejected: "red",
  withdrawn: "gray",
};

export function DealBadge({ status }: { status: DealStatus }) {
  const t = useTranslations("dealStatus");
  return <Badge tone={dealTone[status]}>{t(status)}</Badge>;
}

export function ProposalBadge({ status }: { status: ProposalStatus }) {
  const t = useTranslations("proposalStatus");
  return <Badge tone={proposalTone[status]}>{t(status)}</Badge>;
}
