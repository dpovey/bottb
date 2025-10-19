import { WebLayout } from "@/components/layouts";

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WebLayout>{children}</WebLayout>;
}
