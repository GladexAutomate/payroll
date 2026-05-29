import { ArrowLeft, ArrowRight, ArrowDown, Trash2 } from 'lucide-react';

// Small popover shown after a card is dropped on a cell.
// Offers: fill left, fill right, fill down, or delete the cell.
export default function CellFillMenu({ onFill, onDelete, onClose }) {
  const Btn = ({ icon: Icon, label, onClick, danger }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[11px] font-medium rounded hover:bg-muted ${danger ? 'text-destructive' : 'text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-popover border border-border rounded-lg shadow-lg p-1">
        <Btn icon={ArrowLeft} label="Fill Left" onClick={() => onFill('left')} />
        <Btn icon={ArrowRight} label="Fill Right" onClick={() => onFill('right')} />
        <Btn icon={ArrowDown} label="Fill Down" onClick={() => onFill('down')} />
        <div className="my-1 border-t border-border" />
        <Btn icon={Trash2} label="Delete" onClick={onDelete} danger />
      </div>
    </>
  );
}