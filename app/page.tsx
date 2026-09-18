import type { Metadata } from "next";
import { LandingPage } from "@/components/features/landing/landing-page";

export const metadata: Metadata = {
  title: "JK Intelligence — Agency Organic Growth Platform",
  description:
    "Unified organic search performance, technical crawl diagnostics, and AI visibility for multi-client agencies.",
};

export default function Page() {
  return <LandingPage />;
}