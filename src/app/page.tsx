import type { Metadata } from "next";
import { MerchantDeskMarketingSite } from "@/components/marketing/merchantdesk-marketing-site";
import { brand } from "@/lib/branding";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: `${brand.productName} | CRM for Merchant Services Growth`,
  description:
    "MerchantDesk brings sales, underwriting, onboarding, documents, residuals, and AI-assisted work into one controlled workspace for merchant processing teams.",
  openGraph: {
    title: `${brand.productName} | CRM for Merchant Services Growth`,
    description:
      "A polished CRM for ISOs, agents, managers, and operations teams that need pipeline control, merchant onboarding, residual tracking, and Copilot-powered execution.",
    ...(siteUrl ? { url: siteUrl } : {}),
    ...(siteUrl ? { images: ["/merchantdesk-logo.png"] } : {}),
  },
};

export default function LandingPage() {
  return <MerchantDeskMarketingSite />;
}
