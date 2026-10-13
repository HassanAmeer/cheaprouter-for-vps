import { ShimmerList, ShimmerPage } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage action>
      <ShimmerList rows={5} />
    </ShimmerPage>
  );
}
