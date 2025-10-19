import { WebLayout } from "@/components/layouts";

export default function BandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WebLayout>{children}</WebLayout>;
}
