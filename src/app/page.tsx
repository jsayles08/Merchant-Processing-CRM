import type { Metadata } from "next";
import { MerchantDeskMarketingSite } from "@/components/marketing/merchantdesk-marketing-site";
import { brand } from "@/lib/branding";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: `${brand.productName} | CRM for Merchant Services Growth`,
  description:
    "MerchantDesk is a branded CRM for merchant services teams managing sales pipelines, onboarding, underwriting, residuals, payroll, documents, and AI-assisted work.",
  openGraph: {
    title: `${brand.productName} | CRM for Merchant Services Growth`,
    description:
      "A polished CRM for ISOs, agents, managers, and operations teams that need pipeline control, merchant onboarding, residual tracking, and Copilot-powered execution.",
    ...(siteUrl ? { images: ["/merchantdesk-logo.png"] } : {}),
  },
};

export default function LandingPage() {
  return <MerchantDeskMarketingSite />;
}
