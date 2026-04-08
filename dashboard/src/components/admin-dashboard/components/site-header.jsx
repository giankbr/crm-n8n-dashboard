import { IconChevronRight, IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({
  title = "Control Center",
  isDarkMode = false,
  onToggleDarkMode = () => {},
  username = "",
  onLogout = () => {}
}) {
  return (
    <header
      className="bg-background/90 sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 h-8 w-8 text-foreground hover:bg-muted/70 hover:text-foreground" />
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Dashboard</span>
          <IconChevronRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{title}</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {username ? <span className="hidden text-xs text-muted-foreground sm:inline">{username}</span> : null}
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0 border-border bg-card text-foreground hover:bg-muted sm:w-auto sm:px-2.5 sm:gap-1"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}>
            {isDarkMode ? <IconSun /> : <IconMoon />}
            <span className="hidden sm:inline">{isDarkMode ? "Light" : "Dark"}</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
