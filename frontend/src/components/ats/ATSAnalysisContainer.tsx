'use client';

import { useEffect } from 'react';
import { useATSProgressiveAnalysis } from '@/lib/api/hooks';
import ATSProgressStepper from './ATSProgressStepper';
import { motion, AnimatePresence } from 'motion/react';

interface ATSAnalysisContainerProps {
  resumeId: number;
  jobId: number;
  autoStart?: boolean;
  debounceMs?: number;
}

export default function ATSAnalysisContainer({
  resumeId,
  jobId,
  autoStart = true,
  debounceMs = 2500,
}: ATSAnalysisContainerProps) {
  const { startAnalysis, isAnalyzing, compositeScore, fatalError, resetAnalysis } = useATSProgressiveAnalysis();

  useEffect(() => {
    if (!autoStart) return;
    const timeoutId = setTimeout(() => {
      startAnalysis(resumeId, jobId);
    }, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [resumeId, jobId, autoStart, debounceMs, startAnalysis]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-100 mb-2">ATS Compatibility Analysis</h2>
        <p className="text-neutral-400 text-sm">Analyzing your resume across 5 dimensions</p>
      </div>

      <AnimatePresence>
        {fatalError && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-red-950/20 border border-red-900 rounded-lg p-4 mb-6">
            <h3 className="text-red-400 font-semibold mb-2">Analysis Failed</h3>
            <p className="text-neutral-300 text-sm mb-4">{fatalError}</p>
            <button onClick={() => { resetAnalysis(); startAnalysis(resumeId, jobId); }} className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded text-sm font-medium transition">
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ATSProgressStepper />

      {compositeScore && !isAnalyzing && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex gap-4 justify-center">
          <button onClick={() => { resetAnalysis(); startAnalysis(resumeId, jobId); }} className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition text-sm">
            Re-run
          </button>
          <button onClick={() => console.log('Export', compositeScore)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition text-sm">
            Export Report
          </button>
        </motion.div>
      )}
    </div>
  );
}
