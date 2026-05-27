import { useRef, useEffect } from 'react';

/**
 * Wraps a wide table with TWO horizontal scrollbars:
 * one fixed at the top, one (the natural one) at the bottom of the table.
 * Scrolling either bar keeps both in sync.
 */
export default function TableWithTopScrollbar({ children }) {
  const topRef = useRef(null);
  const bodyRef = useRef(null);
  const bottomRef = useRef(null);
  const spacerRef = useRef(null);
  const bottomSpacerRef = useRef(null);
  const syncing = useRef(false);

  // Sync the mirror spacers' widths to the table's actual scrollWidth
  useEffect(() => {
    const updateWidth = () => {
      const table = bodyRef.current?.querySelector('table');
      if (table) {
        const w = table.scrollWidth + 'px';
        if (spacerRef.current) spacerRef.current.style.width = w;
        if (bottomSpacerRef.current) bottomSpacerRef.current.style.width = w;
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

  // Keep all three scrollers in sync without infinite loops
  const syncFrom = (sourceLeft, sourceEl) => {
    if (syncing.current) return;
    syncing.current = true;
    if (bodyRef.current && bodyRef.current !== sourceEl) bodyRef.current.scrollLeft = sourceLeft;
    if (topRef.current && topRef.current !== sourceEl) topRef.current.scrollLeft = sourceLeft;
    if (bottomRef.current && bottomRef.current !== sourceEl) bottomRef.current.scrollLeft = sourceLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  };
  const handleTopScroll = (e) => syncFrom(e.currentTarget.scrollLeft, e.currentTarget);
  const handleBodyScroll = (e) => syncFrom(e.currentTarget.scrollLeft, e.currentTarget);
  const handleBottomScroll = (e) => syncFrom(e.currentTarget.scrollLeft, e.currentTarget);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Top mirrored scrollbar */}
      <div
        ref={topRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b border-border"
        style={{ height: 16 }}
      >
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      {/* Actual table — hide its native horizontal scrollbar; vertical only */}
      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        className="overflow-x-auto overflow-y-auto max-h-[70vh]"
      >
        {children}
      </div>
      {/* Bottom mirrored scrollbar */}
      <div
        ref={bottomRef}
        onScroll={handleBottomScroll}
        className="overflow-x-auto overflow-y-hidden border-t border-border"
        style={{ height: 16 }}
      >
        <div ref={bottomSpacerRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}