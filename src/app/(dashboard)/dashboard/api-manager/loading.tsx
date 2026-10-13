import { ShimmerPage, ShimmerTable } from "@/shared/components";

export default function Loading() {
  return (
    <ShimmerPage action toolbar>
      <ShimmerTable rows={6} cols={5} />
    </ShimmerPage>
  );
}
