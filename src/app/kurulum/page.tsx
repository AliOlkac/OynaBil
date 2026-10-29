import { Suspense } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { SetupScreen } from "./SetupScreen";

export const metadata = { title: "Oyun kur · OynaBil" };

export default function SetupPage() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-ink-900" />}>
      <Suspense fallback={null}>
        <SetupScreen />
      </Suspense>
    </ClientOnly>
  );
}
