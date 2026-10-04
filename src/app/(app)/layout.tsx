import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-28">
      <header className="safe-top mx-auto flex max-w-md items-center justify-between px-6 pt-3">
        <Link href="/today" className="font-serif text-lg italic tracking-tight">
          AscendHabit
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-md px-6 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
