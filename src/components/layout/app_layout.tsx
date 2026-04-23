import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
