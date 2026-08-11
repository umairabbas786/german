import { RotateCcw } from 'lucide-react';

export interface RoadmapControlsProps {
  roadmapEnabled: boolean;
  hasRoadmap: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReset: () => void;
}

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
    <div className="gg-roadmap-controls" data-tour="langey-guide-roadmap">
      {roadmapEnabled && hasRoadmap && (
        <button
          type="button"
          className="gg-roadmap-reset-btn"
          onClick={onReset}
          aria-label="Reset roadmap"
        >
          <RotateCcw size={16} strokeWidth={2.25} />
        </button>
      )}
      <div className="gg-roadmap-toggle-row">
        <span className="gg-roadmap-toggle-label">Roadmap</span>
        <button
          type="button"
          className={`gg-roadmap-switch${roadmapEnabled ? ' active' : ''}`}
          onClick={handleToggle}
          role="switch"
          aria-checked={roadmapEnabled}
          aria-label={roadmapEnabled ? 'Disable roadmap' : 'Enable roadmap'}
        >
          <span />
        </button>
      </div>
    </div>
  );
}
