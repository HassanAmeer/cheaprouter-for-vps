import { ShimmerPage, ShimmerTable } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage toolbar>
      <ShimmerTable rows={8} cols={4} />
    </ShimmerPage>
  );
}
