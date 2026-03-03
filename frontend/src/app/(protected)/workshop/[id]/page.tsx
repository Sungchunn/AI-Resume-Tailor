"use client";

import { use } from "react";
import { WorkshopProvider } from "@/components/workshop/WorkshopProvider";
import { WorkshopLayout } from "@/components/workshop/WorkshopLayout";

interface WorkshopPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkshopPage({ params }: WorkshopPageProps) {
  const { id } = use(params);

  if (!id) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid workshop ID</p>
      </div>
    );
  }

  return (
    <WorkshopProvider tailoredId={id}>
      <WorkshopLayout />
    </WorkshopProvider>
  );
}
