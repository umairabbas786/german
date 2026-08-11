import { Settings } from 'lucide-react';

export interface SettingsIconButtonProps {
  onClick: () => void;
  active?: boolean;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

export function SettingsIconButton({ onClick, active = false }: SettingsIconButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[18px] border-[1.5px] border-black/18 bg-transparent text-langey-ink shadow-[0_2px_4px_-1px_rgba(0,0,0,.06)] transition-[background,transform,box-shadow,border-color] duration-150 hover:scale-[1.03] hover:border-black/40 hover:bg-black/4 hover:shadow-none max-lg:h-[34px] max-lg:w-[34px] max-lg:rounded-[17px]',
        active &&
          'border-langey-ink bg-langey-ink text-white shadow-none hover:border-black hover:bg-black',
      )}
      onClick={onClick}
      aria-label={active ? 'Settings open' : 'Open settings'}
      aria-current={active ? 'page' : undefined}
    >
      <Settings size={17} strokeWidth={2.1} />
    </button>
  );
}
