"use client";

import { useState, useRef, useEffect } from "react";
import { useResumes, useDeleteResume, useSetMasterResume, useUpdateProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ResumeUploadModal } from "@/components/upload";
import { AboutMeSection } from "@/components/library/AboutMeSection";
import { ResumeTimeline } from "@/components/library/ResumeTimeline";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { data: resumes, isLoading } = useResumes();
  const deleteResume = useDeleteResume();
  const setMasterResume = useSetMasterResume();
  const updateProfile = useUpdateProfile();
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

  // Use user headline if set, otherwise fall back to resume title
  const displayHeadline = user?.headline || contactInfo.title;

  const handleHeadlineUpdate = async (newHeadline: string) => {
    await updateProfile.mutateAsync({ headline: newHeadline || null });
    refreshUser();
  };

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
            <EditableHeadline
              value={displayHeadline || ""}
              placeholder="Your Title"
              onSave={handleHeadlineUpdate}
              isSaving={updateProfile.isPending}
            />
          </div>

          {/* Right: About */}
          <div>
            <AboutMeSection variant="minimal" />
          </div>
        </div>

        {/* Experience Section */}
        <div className="grid grid-cols-[280px_1fr] gap-16 mb-12">
          <div>
            <h2 className="text-sm font-medium text-foreground">Experience</h2>
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

interface EditableHeadlineProps {
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  isSaving: boolean;
}

function EditableHeadline({ value, placeholder, onSave, isSaving }: EditableHeadlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue.trim() !== value) {
      await onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="mt-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full bg-transparent border-b border-primary text-muted-foreground focus:outline-none focus:border-primary py-0.5"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 mt-1 text-left w-full"
    >
      <span className={`${value ? "text-muted-foreground" : "text-muted-foreground/50 italic"}`}>
        {value || placeholder}
      </span>
      <PencilIcon className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      />
    </svg>
  );
}
