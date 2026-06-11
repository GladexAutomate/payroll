import { HelpCircle } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import { useCurrentTier } from '@/hooks/useCurrentTier';

// Top-bar Help button that launches the coached tour.
// Visible only to HR and managers (admins resolve to 'hr' tier).
export default function TourLaunchButton() {
  const { startTour } = useTour();
  const { loading, tier } = useCurrentTier();

  if (loading || !['hr', 'managers'].includes(tier)) return null;

  return (
    <button
      onClick={startTour}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Take a guided tour"
    >
      <HelpCircle className="w-4.5 h-4.5" />
      <span className="hidden sm:block text-sm font-medium">Help</span>
    </button>
  );
}