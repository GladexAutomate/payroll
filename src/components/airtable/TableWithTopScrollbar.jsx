import { useRef, useEffect } from 'react';

/**
 * Wraps a wide table with TWO horizontal scrollbars:
 * one fixed at the top, one (the natural one) at the bottom of the table.
 * Scrolling either bar keeps both in sync.
 */
export default function TableWithTopScrollbar({ children }) {
  const topRef = useRef(null);
  const bodyRef = useRef(null);
  const spacerRef = useRef(null);

  // Sync the top spacer width to the table's actual scrollWidth
  useEffect(() => {
    const updateWidth = () => {
      const table = bodyRef.current?.querySelector('table');
      if (table && spacerRef.current) {
        spacerRef.current.style.width = table.scrollWidth + 'px';
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (bodyRef.current) ro.observe(bodyRef.current);
    const table = bodyRef.current?.querySelector('table');
    if (table) ro.observe(table);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [children]);

  const handleTopScroll = (e) => {
    if (bodyRef.current) bodyRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };
  const handleBodyScroll = (e) => {
    if (topRef.current) topRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Actual table */}
      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        className="overflow-auto max-h-[70vh]"
      >
        {children}
      </div>
      {/* Bottom mirrored scrollbar (visible without scrolling the table down) */}
      <div
        ref={topRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden border-t border-border"
        style={{ height: 14 }}
      >
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}