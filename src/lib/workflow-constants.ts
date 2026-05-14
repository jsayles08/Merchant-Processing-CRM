import type { AgentOnboardingStatus, MerchantOnboardingStatus, RecruitStatus, SignatureStatus } from "@/lib/types";

export const recruitStatuses: { value: RecruitStatus; label: string }[] = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "application_started", label: "Application Started" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

export const agentOnboardingStatuses: { value: AgentOnboardingStatus; label: string }[] = [
  { value: "invited", label: "Invited" },
  { value: "profile_incomplete", label: "Profile Incomplete" },
  { value: "training", label: "Training" },
  { value: "documents_pending", label: "Documents Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
];

export const merchantOnboardingStatuses: { value: MerchantOnboardingStatus; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "application_started", label: "Application Started" },
  { value: "documents_needed", label: "Documents Needed" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "declined", label: "Declined" },
];

export const signatureStatuses: { value: SignatureStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "signed", label: "Signed" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

export const agentOnboardingStepTemplates = [
  "Complete agent profile",
  "Review merchant processing training",
  "Sign agent agreement",
  "Submit payout and tax details",
  "Admin review and approval",
  "Activate CRM access",
];

export const merchantOnboardingStepTemplates = [
  "Capture business and ownership details",
  "Confirm processing needs",
  "Collect statements and void check",
  "Submit processor application",
  "Underwriting review",
  "Board account and schedule first batch",
];

export function labelForStatus(status: string, options: { value: string; label: string }[]) {
  return options.find((option) => option.value === status)?.label ?? status;
}
