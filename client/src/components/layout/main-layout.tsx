import { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BreadcrumbNavigation } from "./breadcrumb-navigation";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <BreadcrumbNavigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
