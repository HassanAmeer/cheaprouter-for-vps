import { Suspense } from "react";
import EndpointPageClient from "./EndpointPageClient";
import { ShimmerPageLoader } from "@/shared/components";

export default function EndpointPage() {
  return (
    <Suspense fallback={<ShimmerPageLoader />}>
      <EndpointPageClient machineId="" />
    </Suspense>
  );
}
