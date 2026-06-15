import type { BlockType } from '@/lib/blocks';

import Accordeon from '@/assets/icons/blocks/Accordeon.svg';
import Audio from '@/assets/icons/blocks/Audio.svg';
import Carousel from '@/assets/icons/blocks/Carousel.svg';
import Checklist from '@/assets/icons/blocks/Checklist.svg';
import Code from '@/assets/icons/blocks/Code.svg';
import DefaultText from '@/assets/icons/blocks/Default_text.svg';
import Devider from '@/assets/icons/blocks/Devider.svg';
import Formula from '@/assets/icons/blocks/Formula.svg';
import H1 from '@/assets/icons/blocks/H1_title.svg';
import H2 from '@/assets/icons/blocks/H2_title.svg';
import H3 from '@/assets/icons/blocks/H3_title.svg';
import Image from '@/assets/icons/blocks/Image.svg';
import List from '@/assets/icons/blocks/List.svg';
import Numbered from '@/assets/icons/blocks/Numorous_list.svg';
import Setka from '@/assets/icons/blocks/Setka.svg';
import Table from '@/assets/icons/blocks/Table.svg';
import Time from '@/assets/icons/blocks/Time.svg';
import Video from '@/assets/icons/blocks/Video.svg';

export interface BlockMeta {
  type: BlockType;
  label: string;
  icon: string;
}

export interface DrawerSection {
  title: string;
  items: BlockMeta[];
}

export const DRAWER_SECTIONS: DrawerSection[] = [
  {
    title: 'Текст',
    items: [
      { type: 'h1', label: 'Заголовок', icon: H1 },
      { type: 'h2', label: 'Заголовок', icon: H2 },
      { type: 'h3', label: 'Заголовок', icon: H3 },
      { type: 'text', label: 'Дефолтный', icon: DefaultText },
    ],
  },
  {
    title: 'Списки',
    items: [
      { type: 'bullets', label: 'Буллеты', icon: List },
      { type: 'numbered', label: 'Нумерация', icon: Numbered },
      { type: 'checklist', label: 'Чеклист', icon: Checklist },
      { type: 'accordion', label: 'Аккордеон', icon: Accordeon },
    ],
  },
  {
    title: 'Медиа',
    items: [
      { type: 'image', label: 'Изображение', icon: Image },
      { type: 'carousel', label: 'Карусель', icon: Carousel },
      { type: 'grid', label: 'Сетка', icon: Setka },
      { type: 'audio', label: 'Аудио', icon: Audio },
      { type: 'video', label: 'Видео', icon: Video },
    ],
  },
  {
    title: 'Другое',
    items: [
      { type: 'code', label: 'Код', icon: Code },
      { type: 'formula', label: 'Формула', icon: Formula },
      { type: 'divider', label: 'Разделитель', icon: Devider },
      { type: 'time', label: 'Время', icon: Time },
      { type: 'table', label: 'Таблица', icon: Table },
    ],
  },
];

export const BLOCK_LABEL: Record<BlockType, string> = Object.fromEntries(
  DRAWER_SECTIONS.flatMap((s) => s.items.map((i) => [i.type, i.label])),
) as Record<BlockType, string>;
