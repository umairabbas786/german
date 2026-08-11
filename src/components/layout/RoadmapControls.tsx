import { RotateCcw } from 'lucide-react';

export interface RoadmapControlsProps {
  roadmapEnabled: boolean;
  hasRoadmap: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReset: () => void;
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

export function RoadmapControls({
  roadmapEnabled,
  hasRoadmap,
  onEnable,
  onDisable,
  onReset,
}: RoadmapControlsProps) {
  const handleToggle = () => {
    if (roadmapEnabled) {
      onDisable();
    } else {
      onEnable();
    }
  };

  return (
    <div className="inline-flex shrink-0 items-center gap-2" data-tour="langey-guide-roadmap">
      {roadmapEnabled && hasRoadmap && (
        <button
          type="button"
          className="inline-flex h-9 w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[18px] border-[1.5px] border-red-500/48 bg-transparent text-red-500 shadow-[0_2px_4px_-1px_rgba(0,0,0,.06)] transition-[background,border-color,color] duration-150 hover:border-red-600 hover:bg-red-50 hover:text-red-600 max-lg:h-[34px] max-lg:rounded-[17px]"
          onClick={onReset}
          aria-label="Reset roadmap"
        >
          <RotateCcw size={16} strokeWidth={2.25} />
        </button>
      )}
      <div className="inline-flex h-9 shrink-0 items-center gap-2.5 rounded-[18px] border-[1.5px] border-black/18 bg-transparent py-0 pr-3 pl-3.5 max-lg:h-[34px] max-lg:gap-2 max-lg:pr-2.5 max-lg:pl-3">
        <span className="text-xs font-semibold tracking-[0.01em] whitespace-nowrap text-langey-ink max-lg:text-[11px]">
          Roadmap
        </span>
        <button
          type="button"
          className={cx(
            'h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-none bg-black/12 p-0.5 transition-colors duration-200 max-lg:h-5 max-lg:w-9',
            roadmapEnabled && 'bg-langey-ink',
          )}
          onClick={handleToggle}
          role="switch"
          aria-checked={roadmapEnabled}
          aria-label={roadmapEnabled ? 'Disable roadmap' : 'Enable roadmap'}
        >
          <span
            className={cx(
              'block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.16)] transition-transform duration-200 max-lg:h-4 max-lg:w-4',
              roadmapEnabled && 'translate-x-[18px] max-lg:translate-x-4',
            )}
          />
        </button>
      </div>
    </div>
  );
}
