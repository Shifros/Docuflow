"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  DollarSign,
  Inbox,
  LayoutDashboard,
  Search,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  pendingCount: number;
};

const navItems = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Triage Inbox",
    href: "/dashboard/triage",
    icon: Inbox,
    showBadge: true,
    exact: false,
  },
  {
    name: "Projects & Retainers",
    href: "/dashboard/projects",
    icon: Briefcase,
    exact: false,
  },
  {
    name: "Team & Time",
    href: "/dashboard/team",
    icon: Users,
    exact: false,
  },
  {
    name: "Revenue",
    href: "/dashboard/revenue",
    icon: DollarSign,
    exact: false,
  },
  {
    name: "Vendors",
    href: "/dashboard/vendors",
    icon: Store,
    exact: false,
  },
];

export function AppSidebar({ pendingCount }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-5">
        <p className="text-xl font-semibold tracking-[0.14em] text-sidebar-foreground uppercase">
          Your Agency
        </p>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search…"
            disabled
            className="h-10 w-full rounded-lg border border-sidebar-border bg-sidebar-accent pl-9 pr-3 text-base text-muted-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "dashboard-nav-item",
                isActive
                  ? "dashboard-nav-item-active"
                  : "dashboard-nav-item-inactive",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="flex-1">{item.name}</span>
              {item.showBadge && pendingCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 ring-1 ring-sidebar-border">
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar text-xs font-medium text-muted-foreground">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-foreground">
              Demo Mode
            </p>
            <p className="truncate text-sm text-muted-foreground">
              Agency workspace
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
