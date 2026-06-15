import { EditorScreen } from '@/components/EditorScreen';
import { useTelegramTheme } from '@/hooks/useTelegramTheme';

export default function App() {
  useTelegramTheme();
  return <EditorScreen />;
}
