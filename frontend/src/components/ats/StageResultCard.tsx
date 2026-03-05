'use client';

import { motion } from 'motion/react';

interface StageResultCardProps {
  stageData: any;
}

export default function StageResultCard({ stageData }: StageResultCardProps) {
  if (!stageData) {
    return <div className="text-center text-neutral-400 py-8">Waiting to start...</div>;
  }

  if (stageData.status === 'running') {
    return (
      <div className="text-center py-8">
        <motion.div
          className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        />
        <p className="mt-4 text-neutral-300">{stageData.stageName}...</p>
      </div>
    );
  }

  if (stageData.status === 'failed') {
    return (
      <div className="bg-red-950/20 border border-red-900 rounded-lg p-4">
        <h3 className="text-red-400 font-semibold">Stage Failed</h3>
        <p className="text-neutral-300 text-sm">{stageData.error}</p>
      </div>
    );
  }

  if (stageData.status === 'completed' && stageData.result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-100">{stageData.stageName}</h3>
          <span className="text-xs text-neutral-500">{stageData.elapsedMs}ms</span>
        </div>
        <p className="text-neutral-300">Stage {stageData.stage} completed successfully</p>
      </motion.div>
    );
  }

  return null;
}
