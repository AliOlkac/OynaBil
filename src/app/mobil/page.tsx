import { ClientOnly } from "@/components/ClientOnly";
import { MobileApp } from "@/mobile/MobileApp";

export const metadata = { title: "OynaBil Mobil" };

/** Mobil prototip: telefonda tek kişilik dereceli maçlar (bkz. docs/MOBIL-PLATFORM.md). */
export default function MobilePage() {
  return (
    <ClientOnly fallback={<div className="h-dvh bg-ink-950" />}>
      <MobileApp />
    </ClientOnly>
  );
}
