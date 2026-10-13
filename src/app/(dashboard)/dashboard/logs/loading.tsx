import { ShimmerList, ShimmerPage } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage toolbar>
      <ShimmerList rows={8} />
    </ShimmerPage>
  );
}
