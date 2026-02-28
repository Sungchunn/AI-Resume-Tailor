import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <main className="flex-1 pt-8 px-6 pb-6">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
