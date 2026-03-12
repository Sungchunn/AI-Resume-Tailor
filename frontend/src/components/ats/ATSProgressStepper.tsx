'use client';

import { AnimatePresence, motion } from 'motion/react';
import React, { useMemo } from 'react';
import { useATSProgressStore } from '@/lib/stores/atsProgressStore';
import StageResultCard from './StageResultCard';

interface ATSProgressStepperProps {
  className?: string;
}

export default function ATSProgressStepper({ className = '' }: ATSProgressStepperProps) {
  const { stages, currentStage, overallProgress, isAnalyzing } = useATSProgressStore();

  const steps = useMemo(() => [
    { stage: 0, name: 'Knockout Check' },
    { stage: 1, name: 'Structure' },
    { stage: 2, name: 'Keywords' },
    { stage: 3, name: 'Content Quality' },
    { stage: 4, name: 'Role Proximity' },
    { stage: 5, name: 'Final Score' },
  ], []);

  return (
    <div className={`ats-progress-stepper ${className}`}>
      <div className="relative w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-8">
        <motion.div
          className="absolute inset-y-0 left-0 bg-linear-to-r from-purple-500 to-purple-600"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex items-center justify-between mb-8 gap-2">
        {steps.map((step, index) => {
          const stageData = stages[step.stage];
          const status = stageData?.status || 'pending';
          const isActive = currentStage === step.stage && isAnalyzing;

          return (
            <React.Fragment key={step.stage}>
              <div className="flex flex-col items-center gap-2 flex-1">
                <motion.div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center"
                  animate={
                    status === 'completed'
                      ? { backgroundColor: '#5227FF' }
                      : isActive
                      ? { backgroundColor: '#5227FF', scale: 1.1 }
                      : { backgroundColor: '#27272a' }
                  }
                >
                  {status === 'completed' ? (
                    <span className="text-white">✓</span>
                  ) : isActive ? (
                    <motion.div className="w-2 h-2 rounded-full bg-white" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                  ) : (
                    <span className="text-xs font-medium text-neutral-400">{index + 1}</span>
                  )}
                </motion.div>
                <span className="text-xs font-medium text-center text-neutral-500">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 bg-neutral-800 mx-1" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-50"
        >
          <StageResultCard stageData={stages[currentStage]} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
