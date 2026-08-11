import { Settings } from 'lucide-react';

export interface SettingsIconButtonProps {
  onClick: () => void;
  active?: boolean;
}

export function SettingsIconButton({ onClick, active = false }: SettingsIconButtonProps) {
  return (
    <button
      type="button"
      className={`gg-settings-icon-btn${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label={active ? 'Settings open' : 'Open settings'}
      aria-current={active ? 'page' : undefined}
    >
      <Settings size={17} strokeWidth={2.1} />
    </button>
  );
}
