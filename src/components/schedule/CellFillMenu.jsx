import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X } from 'lucide-react';

// Popover shown when an assigned cell is clicked (or after a card is dropped).
// Offers directional fill (up/down/left/right) and delete.
export default function CellFillMenu({ onFill, onDelete, onClose }) {
  const Btn = ({ icon: Icon, dir, danger, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      title={dir}
      className={`flex items-center justify-center w-7 h-7 rounded hover:bg-muted ${danger ? 'text-destructive' : 'text-foreground'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border border-border rounded-lg shadow-lg p-1.5">
        <div className="grid grid-cols-3 gap-0.5 place-items-center">
          <span />
          <Btn icon={ArrowUp} dir="Fill Up" onClick={() => onFill('up')} />
          <span />
          <Btn icon={ArrowLeft} dir="Fill Left" onClick={() => onFill('left')} />
          <Btn icon={X} dir="Delete" danger onClick={onDelete} />
          <Btn icon={ArrowRight} dir="Fill Right" onClick={() => onFill('right')} />
          <span />
          <Btn icon={ArrowDown} dir="Fill Down" onClick={() => onFill('down')} />
          <span />
        </div>
      </div>
    </>
  );
}