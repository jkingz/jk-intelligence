"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plug } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  APP_DESTINATIONS,
  activeDestination,
  type DestinationIcon,
} from "@/lib/navigation/destinations";
import { NavUser } from "./nav-user";

const ICONS: Record<DestinationIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  connections: Plug,
};

export function AppNav() {
  const pathname = usePathname();
  const active = activeDestination(pathname);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Collapsed the header has 2rem of content width — exactly one icon per row —
            so the trigger drops below the brand tile instead of competing with it.
            The 8px padding either side of that tile is why the label hides rather than
            the row reflowing. */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground">
              J
            </div>
            <span className="truncate font-serif text-lg font-medium tracking-tight group-data-[collapsible=icon]:hidden">
              JK Intelligence
            </span>
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col">
          <SidebarGroup>
            <SidebarMenu>
              {APP_DESTINATIONS.map((destination) => {
                const Icon = ICONS[destination.icon];
                const isSelected = destination.href === active;
                return (
                  <SidebarMenuItem key={destination.href}>
                    <SidebarMenuButton
                      isActive={isSelected}
                      tooltip={destination.label}
                      render={
                        <Link
                          href={destination.href}
                          aria-current={isSelected ? "page" : undefined}
                          // The drawer is a modal over the next page, not a companion to it.
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        />
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{destination.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
