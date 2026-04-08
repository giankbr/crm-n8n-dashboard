import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import {
  BookingSection,
  EscalationsSection,
  InboxSection,
  WahaSection,
  WorkflowRulesSection
} from "./components/crm-sections";
import { SectionCards } from "./components/section-cards";
import { SiteHeader } from "./components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardData } from "./use-dashboard-data";
import { clearAuth, getUsername } from "@/lib/auth";

export default function Page() {
  const { threads, bookings, escalations, sessions, error, stats, loadAll } = useDashboardData();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const username = getUsername();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const titles = {
    "/": "Control Center",
    "/inbox": "Inbox",
    "/bookings": "Booking",
    "/routing": "Routing",
    "/escalations": "Escalations",
    "/waha": "WAHA Sessions",
    "/workflow-rules": "Workflow Rules",
    "/settings": "Settings",
    "/help": "Get Help",
    "/search": "Search"
  };

  const isDashboardHome = location.pathname === "/";

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  function renderContent() {
    switch (location.pathname) {
      case "/":
      case "/inbox":
        return <InboxSection threads={threads} onDataChanged={loadAll} />;
      case "/bookings":
      case "/routing":
        return <BookingSection bookings={bookings} />;
      case "/escalations":
        return <EscalationsSection escalations={escalations} />;
      case "/waha":
        return <WahaSection sessions={sessions} onRefresh={loadAll} />;
      case "/workflow-rules":
        return <WorkflowRulesSection />;
      default:
        return (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Halaman {titles[location.pathname] || location.pathname} belum punya modul khusus.
            </CardContent>
          </Card>
        );
    }
  }

  return (
    <SidebarProvider
      className="min-h-screen"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12 + 1px)"
        }
      }>
      <AppSidebar variant="sidebar" activePath={location.pathname} onNavigate={navigate} />
      <SidebarInset>
        <SiteHeader
          title={titles[location.pathname] || "Control Center"}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          username={username}
          onLogout={handleLogout}
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {isDashboardHome ? <SectionCards stats={stats} /> : null}
              {error ? (
                <div className="px-4 lg:px-6">
                  <Card className="border-destructive">
                    <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
                  </Card>
                </div>
              ) : null}
              <div className="px-4 lg:px-6">{renderContent()}</div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
