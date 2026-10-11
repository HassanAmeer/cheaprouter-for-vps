import { Suspense } from "react";
import UsageDashboardClient from "./UsageDashboardClient";
import { CardSkeleton } from "@/shared/components";

export const metadata = {
  title: "Token & Provider Usage | CheapRouter",
  description: "Detailed analytics on token consumption, providers, and models.",
};

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageDashboardClient />
    </Suspense>
  );
}
