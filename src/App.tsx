import { useEffect, useState } from 'react';
import { ChannelsScreen } from '@/components/ChannelsScreen';
import { EditorScreen } from '@/components/EditorScreen';
import { TabBar, type Tab } from '@/components/TabBar';
import { useTelegramTheme } from '@/hooks/useTelegramTheme';
import { loadChannels } from '@/lib/channels';
import type { Channel } from '@/lib/types';

export default function App() {
  useTelegramTheme();
  const [tab, setTab] = useState<Tab>('editor');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadChannels().then((c) => {
      setChannels(c);
      setLoaded(true);
      // First-run users land on Channels if they have none yet.
      if (c.length === 0) setTab('channels');
    });
  }, []);

  return (
    <div className="min-h-full bg-tg-bg text-tg-text">
      {tab === 'channels' ? (
        <ChannelsScreen channels={channels} onChange={setChannels} />
      ) : (
        <EditorScreen channels={channels} />
      )}
      {loaded && <TabBar active={tab} onChange={setTab} />}
    </div>
  );
}
