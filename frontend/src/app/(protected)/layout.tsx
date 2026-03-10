import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TailoringProvider } from "@/contexts/TailoringContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <TailoringProvider>
        {/* L-frame layout: sidebar color wraps the entire viewport, content card is inset */}
        <div className="h-screen bg-sidebar flex overflow-hidden">
          <Sidebar />
          {/* Content wrapper with L-frame padding */}
          <div className="flex-1 flex flex-col pt-4 pr-4 pb-4 min-h-0">
            <main className="flex-1 bg-background rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 pt-8 px-6 pb-6 overflow-y-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </TailoringProvider>
    </ProtectedRoute>
  );
}
