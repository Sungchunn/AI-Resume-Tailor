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
        <div className="min-h-screen bg-sidebar flex">
          <Sidebar />
          {/* Content wrapper with L-frame padding */}
          <div className="flex-1 flex flex-col pt-4 pr-4 pb-4">
            <main className="flex-1 bg-background rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-auto">
              <div className="pt-8 px-6 pb-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </TailoringProvider>
    </ProtectedRoute>
  );
}
