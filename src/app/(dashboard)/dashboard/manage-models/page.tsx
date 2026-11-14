"use client";

import { Suspense } from "react";
import ManageModelsPanel from "@/app/(dashboard)/dashboard/providers/components/ManageModelsPanel";
import { ShimmerPageLoader } from "@/shared/components";

export default function ManageModelsPage() {
  return (
    <Suspense fallback={<ShimmerPageLoader />}>
      <div className="flex flex-col gap-6">
        <ManageModelsPanel />
      </div>
    </Suspense>
  );
}
