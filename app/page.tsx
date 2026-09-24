import type { Metadata } from "next";
import { LandingPage } from "@/components/features/landing/landing-page";

export const metadata: Metadata = {
  title: "JK Intelligence — Agency Organic Growth Platform",
  description:
    "One dashboard per client for organic search performance — keyword rank history, traffic and CTR, with CSV and PDF reporting.",
};

export default function Page() {
  return <LandingPage />;
}