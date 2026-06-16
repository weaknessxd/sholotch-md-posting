import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { publish } from '@/lib/api';
import { createBlock, isEmptyDocument, serializeToRichHtml, type Block, type BlockType } from '@/lib/blocks';
import { hapticImpact, hapticNotification, showAlert, tgClose } from '@/lib/tg';
import { BlockRow } from './BlockRow';
import { Drawer } from './Drawer';
import logoUrl from '@/assets/icons/blocks/logo.svg';

export function EditorScreen() {
  const [blocks, setBlocks] = useState<Block[]>(() => [createBlock('text')]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const patchBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));

  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setActiveId(null);
  };

  const insertBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [block, ...prev]); // newest first, per spec
    setActiveId(block.id);
    setDrawerOpen(false);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === active.id);
      const to = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, from, to);
    });
  };

  const handleSend = async () => {
    if (isEmptyDocument(blocks) || sending) return;
    setSending(true);
    try {
      await publish(serializeToRichHtml(blocks));
      hapticNotification('success');
      tgClose();
    } catch (err) {
      hapticNotification('error');
      showAlert(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  const empty = isEmptyDocument(blocks);

  return (
    <div className="relative min-h-full bg-white pt-safe">
      {/* Top chrome */}
      <div className="flex items-start justify-between px-[16px] pt-[14px]">
        <img src={logoUrl} alt="" className="h-[40px] w-[40px] select-none" draggable={false} />
        <button
          onClick={handleSend}
          disabled={empty || sending}
          className="rounded-[56px] bg-[#FF0000] px-[16px] py-[6px] font-sans text-[16px] font-bold leading-[1.3] text-white transition-colors hover:bg-[#E90303] active:bg-[#B60505] disabled:opacity-40"
        >
          {sending ? 'Отправка…' : 'Отправить в бота'}
        </button>
      </div>

      {/* Editing zone */}
      <div className="mx-auto flex max-w-[560px] flex-col gap-[4px] px-[10px] pb-[160px] pt-[12px]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((b) => (
              <BlockRow
                key={b.id}
                block={b}
                active={activeId === b.id}
                onActivate={() => setActiveId(b.id)}
                onDone={() => setActiveId(null)}
                onDelete={() => deleteBlock(b.id)}
                onChange={(patch) => patchBlock(b.id, patch)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* FAB "+" */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[16px] pb-safe">
        <div className="pointer-events-auto rounded-[24.639px] bg-[#f7f7f7] p-[6px] transition-colors hover:bg-[#dddddd] active:bg-[#bbbbbb]">
          <button
            onClick={() => {
              hapticImpact('light');
              setDrawerOpen(true);
            }}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[56px] bg-gradient-to-b from-[#ff0000] to-[#603813] font-sans text-[24px] font-bold leading-none text-white"
            aria-label="Добавить блок"
          >
            +
          </button>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelect={insertBlock} />
    </div>
  );
}
