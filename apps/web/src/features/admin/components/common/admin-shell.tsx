"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

interface AdminShellProps {
  readonly children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => { setIsMobileOpen(false); }}
        onToggleCollapse={() => { setIsCollapsed(!isCollapsed); }}
      />

      {/* Main Content Area (offset by sidebar width on desktop) */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${
          isCollapsed ? "lg:mr-18" : "lg:mr-64"
        }`}
      >
        <AdminTopbar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => { setIsCollapsed(!isCollapsed); }}
          onOpenMobile={() => { setIsMobileOpen(true); }}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
