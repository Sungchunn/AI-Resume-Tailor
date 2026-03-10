"use client";

import { useState } from "react";
import { useResumes, useDeleteResume, useSetMasterResume } from "@/lib/api";
import { ResumeUploadModal } from "@/components/upload";
import { AboutMeSection } from "@/components/library/AboutMeSection";
import { ResumeTimeline } from "@/components/library/ResumeTimeline";

export default function ProfilePage() {
  const { data: resumes, isLoading } = useResumes();
  const deleteResume = useDeleteResume();
  const setMasterResume = useSetMasterResume();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this resume?")) {
      deleteResume.mutate(id);
    }
  };

  const handleSetMaster = async (id: string) => {
    setMasterResume.mutate(id);
  };

  // Get master resume for header info
  const masterResume = resumes?.find((r) => r.is_master) || resumes?.[0];

  // Safely extract contact info from parsed resume data
  const getContactInfo = (resume: typeof masterResume) => {
    if (!resume?.parsed) return { name: null, title: null };
    const contact = resume.parsed.contact as Record<string, unknown> | undefined;
    return {
      name: (contact?.name as string) || null,
      title: (contact?.title as string) || null,
    };
  };

  const contactInfo = getContactInfo(masterResume);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-full bg-background">
      {/* Minimalist portfolio layout */}
      <div className="max-w-4xl mx-auto py-12 px-8">
        {/* Two-column header: Name/Title on left, About on right */}
        <div className="grid grid-cols-[280px_1fr] gap-16 mb-16">
          {/* Left: Identity */}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {contactInfo.name || "Your Name"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {contactInfo.title || "Your Title"}
            </p>
          </div>

          {/* Right: About */}
          <div>
            <AboutMeSection variant="minimal" />
          </div>
        </div>

        {/* Work Experience Section */}
        <div className="grid grid-cols-[280px_1fr] gap-16 mb-12">
          <div>
            <h2 className="text-sm font-medium text-foreground">Work Experience</h2>
          </div>
          <div>
            {resumes && resumes.length > 0 ? (
              <ResumeTimeline
                resumes={resumes}
                onDelete={handleDelete}
                onSetMaster={handleSetMaster}
                isDeleting={deleteResume.isPending}
                isSettingMaster={setMasterResume.isPending}
                variant="minimal"
              />
            ) : (
              <EmptyResumes onUpload={() => setIsUploadModalOpen(true)} />
            )}
          </div>
        </div>

        {/* Upload button - floating action */}
        <div className="fixed bottom-8 right-8">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg transition-all hover:scale-105"
            title="Upload Resume"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>

        <ResumeUploadModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
        />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-8">
      <div className="grid grid-cols-[280px_1fr] gap-16 mb-16">
        <div>
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div>
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-[280px_1fr] gap-16">
        <div>
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-8">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyResumes({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-4">
        Upload your resume to build your professional profile.
      </p>
      <button onClick={onUpload} className="btn-primary">
        Upload Resume
      </button>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}
