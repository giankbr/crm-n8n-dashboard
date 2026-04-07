import { IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({ title = "Control Center", isDarkMode = false, onToggleDarkMode = () => {} }) {
  return (
    <header
      className="bg-background/90 sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0 border-border bg-card text-foreground hover:bg-muted sm:w-auto sm:px-2.5 sm:gap-1"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}>
            {isDarkMode ? <IconSun /> : <IconMoon />}
            <span className="hidden sm:inline">{isDarkMode ? "Light" : "Dark"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
