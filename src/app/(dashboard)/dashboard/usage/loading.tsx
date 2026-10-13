import { ShimmerCards, ShimmerPage, ShimmerTable } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage action>
      <ShimmerCards count={4} />
      <ShimmerTable rows={6} cols={5} />
    </ShimmerPage>
  );
}
