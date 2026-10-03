import { BottomNav } from "@/components/layout/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-28">
      <main className="safe-top mx-auto max-w-md px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
