import { Suspense } from "react";
import ApiManagerPageClient from "./ApiManagerPageClient";
import { ShimmerPageLoader } from "@/shared/components";

export default function ApiManagerPage() {
  return (
    <Suspense fallback={<ShimmerPageLoader />}>
      <ApiManagerPageClient />
    </Suspense>
  );
}
