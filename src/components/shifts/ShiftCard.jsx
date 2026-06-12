import { Draggable } from '@hello-pangea/dnd';
import { Pencil, Clock, Trash2, GripVertical } from 'lucide-react';
import { fmtClock } from '@/lib/dateFormat';

export default function ShiftCard({ shift, index, onEdit, onDelete }) {
  return (
    <Draggable draggableId={shift.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-card border border-border rounded-xl p-5 ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-primary' : ''}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <button {...provided.dragHandleProps} className="p-1 -ml-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing" title="Drag to reorder">
                <GripVertical className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${shift.card_color || '#6366f1'}1a` }}>
                <Clock className="w-5 h-5" style={{ color: shift.card_color || '#6366f1' }} />
              </div>
              <div>
                <p className="font-semibold">{shift.name}</p>
                {shift.is_night_shift && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Night Shift</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => onEdit(shift)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(shift.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Start Time</span><span className="font-medium">{fmtClock(shift.start_time)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">End Time</span><span className="font-medium">{fmtClock(shift.end_time)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Break</span><span>{shift.break_minutes || 60} min</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Grace Period</span><span>{shift.grace_period_minutes || 15} min</span></div>
          </div>
        </div>
      )}
    </Draggable>
  );
}