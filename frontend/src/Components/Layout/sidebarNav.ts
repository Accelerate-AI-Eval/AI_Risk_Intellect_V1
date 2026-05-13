import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Briefcase,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from "lucide-react";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** Single source of truth for sidebar routes and icons */
export const SIDEBAR_NAV: readonly SidebarNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/risk", label: "Risks", icon: AlertTriangle },
  { to: "/articles", label: "Articles", icon: FileText },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/users", label: "Users", icon: Users },
];

export function getSidebarNavItem(pathname: string): SidebarNavItem | undefined {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return SIDEBAR_NAV.find((item) => item.to === normalized);
}
