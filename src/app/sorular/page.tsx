import { ClientOnly } from "@/components/ClientOnly";
import { QuestionBank } from "./QuestionBank";

export const metadata = { title: "Soru bankası · OynaBil" };

export default function QuestionBankPage() {
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-ink-900" />}>
      <QuestionBank />
    </ClientOnly>
  );
}
