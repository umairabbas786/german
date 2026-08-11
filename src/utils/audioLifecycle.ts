export interface StoppableAudio {
  currentTime: number;
  src: string;
  pause: () => void;
  load: () => void;
}

export function isModuleMediaActive(
  activeTab: string,
  moduleTab: string,
  mode: string,
): boolean {
  return activeTab === moduleTab && mode !== 'STATS';
}

export function stopHtmlAudio(audio: StoppableAudio | null, releaseSource = false): void {
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;

  if (releaseSource) {
    audio.src = '';
    audio.load();
  }
}
