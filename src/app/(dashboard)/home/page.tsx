import { getMachineId } from "@/shared/utils/machine";
import { loadHomeSettings } from "./loadHomeSettings";
import HomePageClient from "../dashboard/HomePageClient";
import BootstrapBanner from "../dashboard/BootstrapBanner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Settings failures degrade to defaults here (display-only) — see loadHomeSettings (#14060).
  const [, machineId] = await Promise.all([loadHomeSettings(), getMachineId()]);
  const isBootstrapped = process.env.CHEAPROUTE_BOOTSTRAPPED === "true";
  return (
    <>
      {isBootstrapped && <BootstrapBanner />}
      <HomePageClient machineId={machineId} />
    </>
  );
}
