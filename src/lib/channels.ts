import { cloudGetItem, cloudSetItem } from './tg';
import { CHANNELS_KEY, MAX_CHANNELS, type Channel } from './types';

export async function loadChannels(): Promise<Channel[]> {
  const raw = await cloudGetItem(CHANNELS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Channel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveChannels(channels: Channel[]): Promise<boolean> {
  return cloudSetItem(CHANNELS_KEY, JSON.stringify(channels));
}

export async function addChannel(channel: Channel): Promise<Channel[]> {
  const channels = await loadChannels();
  if (channels.some((c) => c.id === channel.id)) {
    // Update existing in place.
    const next = channels.map((c) => (c.id === channel.id ? channel : c));
    await saveChannels(next);
    return next;
  }
  if (channels.length >= MAX_CHANNELS) {
    throw new Error(`Можно добавить не более ${MAX_CHANNELS} каналов`);
  }
  const next = [...channels, channel];
  await saveChannels(next);
  return next;
}

export async function removeChannel(id: string): Promise<Channel[]> {
  const channels = await loadChannels();
  const next = channels.filter((c) => c.id !== id);
  await saveChannels(next);
  return next;
}
