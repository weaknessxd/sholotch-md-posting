import clsx from 'clsx';
import { hapticSelection } from '@/lib/tg';
import { ChannelsIcon, EditorIcon } from './icons';

export type Tab = 'channels' | 'editor';

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; Icon: typeof ChannelsIcon }[] = [
  { id: 'channels', label: 'Каналы', Icon: ChannelsIcon },
  { id: 'editor', label: 'Редактор', Icon: EditorIcon },
];

/**
 * Bottom tab bar — ported from attmpt_editor's glass-chip pattern.
 * Active pill uses the red accent (was blue #5C59FF in attmpt).
 */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-safe">
      <div className="glass pointer-events-auto mb-[16px] flex gap-[6px] rounded-full p-[6px]">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => {
                if (isActive) return;
                hapticSelection();
                onChange(id);
              }}
              className={clsx(
                'flex h-[44px] cursor-pointer items-center gap-[8px] rounded-full border-0 px-[18px] font-sans text-[14px] font-medium leading-none transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : 'bg-transparent text-tg-text/70 hover:text-tg-text',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
