import { createContext, useContext, useState, useCallback } from 'react';

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const endTour = useCallback(() => setActive(false), []);

  return (
    <TourContext.Provider value={{ active, stepIndex, setStepIndex, startTour, endTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}