import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcuts.find(
        s => s.key.toLowerCase() === event.key.toLowerCase() &&
        (!s.ctrlKey || (s.ctrlKey && event.ctrlKey))
      );

      if (shortcut) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        shortcut.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}; 