import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getSidebarNavItem } from "./sidebarNav";

const PAGE_TITLE_ICON_PROPS = {
  size: 22,
  strokeWidth: 1.75,
  className: "mainLayout__pageTitleIcon",
  "aria-hidden": true as const,
};

export type PageHeadingProps = Omit<
  ComponentPropsWithoutRef<"h1">,
  "children"
> & {
  children: ReactNode;
  /** When set, shown instead of the sidebar icon for the current route. */
  pageIcon?: LucideIcon;
};

/** Page h1 with the same icon as the active sidebar item for this route. */
export function PageHeading({
  children,
  className,
  pageIcon,
  ...rest
}: PageHeadingProps) {
  const { pathname } = useLocation();
  const Icon = pageIcon ?? getSidebarNavItem(pathname)?.icon;
  const withIcon = Boolean(Icon);
  const mergedClass = [className, withIcon ? "mainLayout__pageTitle--withIcon" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <h1 className={mergedClass || undefined} {...rest}>
      {Icon ? <Icon {...PAGE_TITLE_ICON_PROPS} /> : null}
      {children}
    </h1>
  );
}
