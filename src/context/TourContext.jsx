import { createContext, useContext, useState, useCallback } from 'react';
import { tourSteps } from '@/lib/tourSteps';

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // The active step list. Defaults to the full payroll-flow tour, but can be
  // overridden with a per-page interactive walkthrough.
  const [steps, setSteps] = useState(tourSteps);

  // Launch the global payroll-flow coached tour (the original "Help" tour).
  const startTour = useCallback(() => {
    setSteps(tourSteps);
    setStepIndex(0);
    setActive(true);
  }, []);

  // Launch an interactive walkthrough for a specific page (the "Guide" button).
  const startPageTour = useCallback((pageSteps) => {
    if (!pageSteps || pageSteps.length === 0) return;
    setSteps(pageSteps);
    setStepIndex(0);
    setActive(true);
  }, []);

  const endTour = useCallback(() => setActive(false), []);

  return (
    <TourContext.Provider value={{ active, steps, stepIndex, setStepIndex, startTour, startPageTour, endTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}