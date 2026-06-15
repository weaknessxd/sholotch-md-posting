import { useRef } from 'react';
import type { BlockType } from '@/lib/blocks';
import { hapticSelection } from '@/lib/tg';
import { DRAWER_SECTIONS } from './blockMeta';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: BlockType) => void;
}

export function Drawer({ open, onClose, onSelect }: DrawerProps) {
  const dragStart = useRef<number | null>(null);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null && e.clientY - dragStart.current > 50) {
      dragStart.current = null;
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop: darken 15% + blur, tap to close */}
      <div
        className="absolute inset-0 bg-black/15 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet — half the screen, slides up */}
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex h-[50vh] max-w-[440px] flex-col rounded-t-[40px] border-x-4 border-t-4 border-[#f7f7f7] bg-white px-[18px] pb-[24px] pt-[12px] transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Grab handle (swipe down to close) */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-[8px]"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={() => (dragStart.current = null)}
        >
          <div className="h-[4px] w-[44px] rounded-full bg-[#e1e1e1]" />
        </div>

        <div className="no-scrollbar flex flex-col gap-[24px] overflow-y-auto pt-[12px]">
          {DRAWER_SECTIONS.map((section) => (
            <div key={section.title} className="flex w-full flex-col gap-[12px]">
              <h2 className="bg-gradient-to-r from-[#b3b3b3] to-[#4d4d4d] bg-clip-text font-display text-[40px] leading-none text-transparent">
                {section.title}
              </h2>
              <div className="flex flex-wrap items-start gap-[10px]">
                {section.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      hapticSelection();
                      onSelect(item.type);
                    }}
                    className="flex items-center justify-center gap-[4px] rounded-[56px] bg-[#F7F7F7] px-[16px] py-[8px] transition-colors hover:bg-[#DDDDDD] active:bg-[#BBBBBB]"
                  >
                    <img src={item.icon} alt="" className="h-[24px] w-[24px]" />
                    <span className="whitespace-nowrap font-sans text-[12px] font-medium leading-[1.3] text-[#656565]">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
