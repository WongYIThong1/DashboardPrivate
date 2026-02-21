"use client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";

const CheckIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn("w-5 h-5", className)}
    >
      <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
};

const CheckFilled = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-5 h-5", className)}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
};

const LoadingSpinner = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn("w-5 h-5 animate-spin", className)}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

type LoadingState = {
  text: string;
  hasProgress?: boolean;
  showStats?: boolean;
};

export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
  onComplete,
  currentStep: externalStep,
  externalProgress,
  statsData,
  isDone: externalIsDone,
}: {
  loadingStates: LoadingState[];
  loading?: boolean;
  duration?: number;
  loop?: boolean;
  onComplete?: () => void;
  currentStep?: number;
  externalProgress?: number;
  statsData?: {
    current: number;
    total: number;
    timeRunning: string;
  };
  isDone?: boolean;
}) => {
  const [internalState, setInternalState] = useState(0);
  const [internalProgress, setInternalProgress] = useState(0);
  const [internalDone, setInternalDone] = useState(false);
  const completionTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Use external step if provided, otherwise use internal
  const currentState = externalStep !== undefined ? externalStep : internalState;
  const progress = externalProgress !== undefined ? externalProgress : internalProgress;
  const isDone = externalIsDone !== undefined ? externalIsDone : internalDone;

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, []);

  // Handle completion when external progress reaches 100 (no setState in effect)
  useEffect(() => {
    if (externalProgress === undefined || externalProgress < 100) return;
    if (completedRef.current) return;

    completedRef.current = true;
    completionTimerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, 1000);

    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    }
  }, [externalProgress, onComplete]);

  useEffect(() => {
    if (!loading) {
      const timer = window.setTimeout(() => {
        setInternalState(0);
        setInternalProgress(0);
        setInternalDone(false);
        completedRef.current = false;
      }, 0);

      return () => window.clearTimeout(timer);
    }

    if (completedRef.current) {
      return;
    }

    // If using external control, skip auto-progression
    if (externalStep !== undefined) {
      return;
    }

    const currentStepData = loadingStates[internalState];
    
    // If current step has progress bar, animate it
    if (currentStepData?.hasProgress && externalProgress === undefined) {
      const progressInterval = setInterval(() => {
        setInternalProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            if (!completedRef.current) {
              completedRef.current = true;
              setInternalDone(true);
              completionTimerRef.current = window.setTimeout(() => {
                onComplete?.();
              }, 1000);
            }
            return 100;
          }
          return prev + 2;
        });
      }, duration / 50);
      
      return () => clearInterval(progressInterval);
    } else {
      // Normal step transition
      const timeout = setTimeout(() => {
        setInternalState((prevState) =>
          loop
            ? prevState === loadingStates.length - 1
              ? 0
              : prevState + 1
            : Math.min(prevState + 1, loadingStates.length - 1)
        );
      }, duration);

      return () => clearTimeout(timeout);
    }
  }, [internalState, loading, loop, loadingStates, duration, onComplete, externalStep, externalProgress]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          
          {/* Dialog */}
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            className="relative bg-background border rounded-xl shadow-lg p-6 min-w-[360px] max-w-md"
          >
            <div className="space-y-3">
              {loadingStates.map((loadingState, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0.4 }}
                  animate={{ 
                    opacity: index <= currentState ? 1 : 0.4,
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {(index < currentState || (index === currentState && isDone)) && (
                        <CheckFilled className="text-emerald-500" />
                      )}
                      {index === currentState && !isDone && (
                        <LoadingSpinner className="text-blue-500" />
                      )}
                      {index > currentState && (
                        <CheckIcon className="text-muted-foreground" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        index === currentState && "text-foreground font-medium",
                        index < currentState && "text-muted-foreground",
                        index > currentState && "text-muted-foreground"
                      )}
                    >
                      {loadingState.text}
                    </span>
                  </div>
                  {/* Progress bar for steps that need it */}
                  {loadingState.hasProgress && index === currentState && (
                    <div className="ml-8">
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                          {progress}%
                        </p>
                        {loadingState.showStats && statsData && statsData.total > 0 && (
                          <p className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                            {statsData.current}/{statsData.total} • {statsData.timeRunning}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              
              {/* Done message - only show when all steps are complete */}
              {isDone && currentState === loadingStates.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 pt-2 border-t mt-3"
                >
                  <CheckFilled className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-500">Done</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
