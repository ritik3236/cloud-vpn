'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { KeyRound, LayoutDashboard, LayoutGrid, LogOut, ScrollText, Server, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppearancePicker } from '@/features/appearance/appearance-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/design-system/ui/avatar';
import { Button } from '@/design-system/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/design-system/ui/sidebar';

const NAV = [
  { href: '/vpn/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/vpn/dashboard/nodes', label: 'Nodes', icon: Server },
  { href: '/vpn/dashboard/configs', label: 'Configs', icon: KeyRound },
  { href: '/vpn/dashboard/users', label: 'Users', icon: Users },
  { href: '/vpn/dashboard/audit', label: 'Audit log', icon: ScrollText },
];

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        <Link href="/vpn/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <KeyRound className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Cloud VPN
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="All services">
              <Link href="/">
                <LayoutGrid />
                <span>All services</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <Avatar className="size-7">
            <AvatarImage src={user?.imageUrl} alt="" />
            <AvatarFallback className="text-xs">
              {(user?.primaryEmailAddress?.emailAddress ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.fullName ?? user?.username ?? 'Staff'}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        <div className="group-data-[collapsible=icon]:hidden">
          <AppearancePicker />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 px-2"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
          >
            <LogOut className="size-4" />
            <span className="text-sm">Log out</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
