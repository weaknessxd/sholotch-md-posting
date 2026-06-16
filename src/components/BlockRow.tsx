import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/lib/blocks';
import { BlockBody } from './BlockBody';
import { CloseIcon, DragDotsIcon } from './icons';

interface BlockRowProps {
  block: Block;
  active: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<Block>) => void;
}

export function BlockRow({ block, active, onActivate, onDelete, onChange }: BlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-start gap-[8px] rounded-[12px] px-[6px] py-[6px] ${
        active ? 'bg-[#f7f7f7]/60' : ''
      } ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
      onFocusCapture={onActivate}
      onClick={onActivate}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-[2px] shrink-0 cursor-grab touch-none p-[2px] text-[#c4c4c4] active:cursor-grabbing"
        aria-label="Переместить блок"
      >
        <DragDotsIcon className="h-[16px] w-[16px]" />
      </button>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <BlockBody block={block} onChange={onChange} />
      </div>

      {/* Active control: delete only (block auto-saves on blur) */}
      {active && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-[6px] top-[6px] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#f7f7f7] text-[#e90303] hover:bg-[#dddddd] active:bg-[#bbbbbb]"
          aria-label="Удалить блок"
        >
          <CloseIcon className="h-[14px] w-[14px]" />
        </button>
      )}
    </div>
  );
}
