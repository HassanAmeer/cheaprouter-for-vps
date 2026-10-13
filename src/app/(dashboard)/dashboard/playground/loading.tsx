import { Shimmer, ShimmerPage } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage action>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-24 w-full" />
          <Shimmer className="h-9 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-24 w-full" />
          <Shimmer className="h-24 w-full" />
        </div>
      </div>
    </ShimmerPage>
  );
}
