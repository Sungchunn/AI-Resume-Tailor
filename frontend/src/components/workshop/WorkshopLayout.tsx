"use client";

import { useEffect } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { useWorkshop } from "./WorkshopContext";
import { WorkshopHeader } from "./WorkshopHeader";
import { WorkshopControlPanel } from "./WorkshopControlPanel";
import { ResumePreview } from "./ResumePreview";
import { MobileControlSheet } from "./MobileControlSheet";
import { WizardContainer } from "./wizard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export function WorkshopLayout() {
  const { state, dispatch } = useWorkshop();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.hasChanges]);

  if (state.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-gray-50">
        <ErrorMessage
          message={state.error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Extract job info for wizard
  const hasJob = !!state.tailoredResume?.job_id;
  // TODO: Fetch actual job title and company when job data is available
  const jobTitle = "this position";
  const company = "the company";

  // Mobile layout: stacked with bottom sheet
  if (isMobile) {
    return (
      <WizardContainer hasJob={hasJob} jobTitle={jobTitle} company={company}>
        <div className="h-screen flex flex-col bg-gray-50">
          <WorkshopHeader compact />

          {/* Preview takes full screen minus header and bottom sheet handle */}
          <div className="flex-1 overflow-auto p-4 pb-16">
            <ResumePreview
              content={state.content}
              style={state.styleSettings}
              sectionOrder={state.sectionOrder}
              activeSection={state.activeSection}
              onSectionClick={(section) =>
                dispatch({ type: "SET_ACTIVE_SECTION", payload: section })
              }
              fitToOnePage={state.fitToOnePage}
            />
          </div>

          {/* Bottom sheet for controls */}
          <MobileControlSheet>
            <WorkshopControlPanel />
          </MobileControlSheet>
        </div>
      </WizardContainer>
    );
  }

  // Desktop layout: split panels
  return (
    <WizardContainer hasJob={hasJob} jobTitle={jobTitle} company={company}>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Persistent Header */}
        <WorkshopHeader />

        {/* Main Content - Split Panels */}
        <div className="flex-1 overflow-hidden">
          <Group orientation="horizontal" className="h-full">
            {/* Left Panel - PDF Preview (55%) */}
            <Panel defaultSize={55} minSize={40} maxSize={70}>
              <div className="h-full bg-gray-100 overflow-auto p-6 flex justify-center">
                <ResumePreview
                  content={state.content}
                  style={state.styleSettings}
                  sectionOrder={state.sectionOrder}
                  activeSection={state.activeSection}
                  onSectionClick={(section) =>
                    dispatch({ type: "SET_ACTIVE_SECTION", payload: section })
                  }
                  fitToOnePage={state.fitToOnePage}
                />
              </div>
            </Panel>

            <Separator className="w-1.5 bg-gray-200 hover:bg-blue-300 transition-colors cursor-col-resize" />

            {/* Right Panel - Controls (45%) */}
            <Panel defaultSize={45} minSize={30} maxSize={60}>
              <WorkshopControlPanel />
            </Panel>
          </Group>
        </div>
      </div>
    </WizardContainer>
  );
}
