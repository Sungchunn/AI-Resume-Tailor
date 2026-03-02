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
        <div className="min-h-screen bg-background flex">
          <Sidebar />
          <main className="flex-1 pt-8 px-6 pb-6">{children}</main>
        </div>
      </TailoringProvider>
    </ProtectedRoute>
  );
}
