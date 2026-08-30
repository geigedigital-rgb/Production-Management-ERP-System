import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { getCurrentUserAccess } from "@/server/auth/access";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const access = await getCurrentUserAccess();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)]">
        <AppSidebar permissions={access?.permissions ?? []} />
        <div className="flex min-w-0 flex-1 flex-col transition-[margin] duration-200">
          <AppTopbar />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
