import { AiDock } from "@/components/AiDock";
import { AppTopbar } from "@/components/AppTopbar";
import { RailNav } from "@/components/RailNav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-dvh bg-[#f6f7f9]">
      <RailNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="flex min-h-0 min-w-0 flex-1">
          <AiDock />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
