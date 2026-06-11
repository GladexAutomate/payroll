import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from '@/context/TourContext';

const PADDING = 8;

// Tries to find the target element, polling briefly while the page mounts.
function useTargetRect(selector, active, stepIndex, pathname) {
  const [rect, setRect] = useState(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (!selector) { setRect(null); setFound(true); return; }

    let tries = 0;
    let raf;
    setFound(false);

    const locate = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        setFound(true);
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
        return;
      }
      tries += 1;
      if (tries < 40) raf = requestAnimationFrame(locate); // ~40 frames
      else { setRect(null); setFound(true); } // give up gracefully, show centered
    };

    raf = requestAnimationFrame(locate);
    return () => raf && cancelAnimationFrame(raf);
  }, [selector, active, stepIndex, pathname]);

  // Keep the highlight aligned on scroll / resize
  useEffect(() => {
    if (!active || !selector) return;
    const update = () => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selector, active, stepIndex]);

  return { rect, found };
}

const TIP_W = 360;
const TIP_H = 240; // approx; used for clamping
const MARGIN = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

// Returns absolute top/left for the tooltip's TOP-LEFT corner, clamped to the viewport
// so it's never rendered off-screen regardless of where the target sits.
function tooltipPosition(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(TIP_W, vw - MARGIN * 2);

  if (!rect) {
    return { top: vh / 2 - TIP_H / 2, left: vw / 2 - w / 2 };
  }

  const gap = 16;
  let top;
  let left;

  switch (placement) {
    case 'right':
      left = rect.left + rect.width + gap;
      top = rect.top + rect.height / 2 - TIP_H / 2;
      break;
    case 'bottom':
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - w / 2;
      break;
    case 'top':
    default: {
      // Prefer above; if not enough room, flip below the target.
      const above = rect.top - gap - TIP_H;
      top = above >= MARGIN ? above : rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - w / 2;
      break;
    }
  }

  // If "right" placement overflows, fall back to left of the target.
  if (placement === 'right' && left + w > vw - MARGIN) {
    left = rect.left - gap - w;
  }

  return {
    top: clamp(top, MARGIN, vh - TIP_H - MARGIN),
    left: clamp(left, MARGIN, vw - w - MARGIN),
  };
}

export default function CoachedTour() {
  const { active, steps: tourSteps, stepIndex, setStepIndex, endTour } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const lastPathRef = useRef(null);

  const step = tourSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

  // Navigate to the step's page when needed
  useEffect(() => {
    if (!active || !step) return;
    if (step.path && location.pathname !== step.path && lastPathRef.current !== step.path) {
      lastPathRef.current = step.path;
      navigate(step.path);
    }
  }, [active, step, location.pathname, navigate]);

  const { rect } = useTargetRect(step?.selector, active, stepIndex, location.pathname);

  const next = useCallback(() => {
    if (isLast) endTour();
    else { lastPathRef.current = null; setStepIndex((i) => i + 1); }
  }, [isLast, endTour, setStepIndex]);

  const prev = useCallback(() => {
    if (!isFirst) { lastPathRef.current = null; setStepIndex((i) => i - 1); }
  }, [isFirst, setStepIndex]);

  // Keyboard controls
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') endTour();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, endTour, next, prev]);

  if (!active || !step) return null;

  const tip = tooltipPosition(rect, step.placement);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmed backdrop with a transparent cut-out around the target */}
      {rect ? (
        <div
          className="absolute rounded-lg ring-4 ring-primary/70 transition-all duration-300 pointer-events-none"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" onClick={endTour} />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-white rounded-xl shadow-2xl border border-border p-5 pointer-events-auto transition-all duration-300"
        style={{ ...tip, width: 'min(92vw, 360px)' }}
      >
        <button
          onClick={endTour}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">{step.group}</span>
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">{stepIndex + 1} / {tourSteps.length}</span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="outline" onClick={prev}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1 mt-3">
          {tourSteps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-muted'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}