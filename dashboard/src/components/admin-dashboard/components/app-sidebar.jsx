"use client";

import * as React from "react";
import {
  IconBrandWhatsapp,
  IconDashboard,
  IconCalendar,
  IconInnerShadowTop,
  IconMessage,
  IconRoute,
  IconSettings,
  IconUserExclamation
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { NavDocuments } from "./nav-documents";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const data = {
  user: {
    name: "CRM Admin",
    email: "admin@fitmotor.local",
    avatar: "/avatars/shadcn.jpg"
  },
  navMain: [
    {
      title: "Control Center",
      path: "/",
      icon: IconDashboard
    },
    {
      title: "Inbox",
      path: "/inbox",
      icon: IconMessage
    },
    {
      title: "Booking",
      path: "/bookings",
      icon: IconCalendar
    },
    {
      title: "Routing",
      path: "/routing",
      icon: IconRoute
    },
    {
      title: "Escalations",
      path: "/escalations",
      icon: IconUserExclamation
    }
  ],
  documents: [
    {
      name: "WAHA Sessions",
      path: "/waha",
      icon: IconBrandWhatsapp
    },
    {
      name: "Workflow Rules",
      path: "/workflow-rules",
      icon: IconSettings
    }
  ]
};

export function AppSidebar({
  activePath = "/",
  onNavigate = () => {},
  ...props
}) {
  return (
    <Sidebar collapsible="icon" className="h-auto" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              render={<a href="#" />}><IconInnerShadowTop className="!size-5" /><span className="text-base font-semibold">Fit Motor CRM</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} activePath={activePath} onNavigate={onNavigate} />
        <NavDocuments items={data.documents} activePath={activePath} onNavigate={onNavigate} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
