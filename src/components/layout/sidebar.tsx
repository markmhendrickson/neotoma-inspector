import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Box,
  Eye,
  FileText,
  GitBranch,
  Network,
  Database,
  Clock,
  Cpu,
  Settings,
} from "lucide-react";

const navGroups = [
  {
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    items: [
      { to: "/entities", label: "Entities", icon: Box },
      { to: "/observations", label: "Observations", icon: Eye },
      { to: "/sources", label: "Sources", icon: FileText },
      { to: "/relationships", label: "Relationships", icon: GitBranch },
      { to: "/graph", label: "Graph Explorer", icon: Network },
    ],
  },
  {
    items: [
      { to: "/schemas", label: "Schemas", icon: Database },
      { to: "/timeline", label: "Timeline", icon: Clock },
      { to: "/interpretations", label: "Interpretations", icon: Cpu },
    ],
  },
  {
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const location = useLocation();

  function isActive(to: string) {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <img src="/favicon.svg" alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
          <span>Neotoma</span>
        </Link>
      </div>
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <nav className="flex flex-col gap-1 p-3">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <Separator className="my-2" />}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
