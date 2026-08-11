import { useEffect, useState } from 'react';

export interface SpeakingTypewriterProps {
  text: string;
  delay?: number;
  shouldAnimate?: boolean;
}

export function SpeakingTypewriter({ text, delay = 50, shouldAnimate = true }: SpeakingTypewriterProps) {
  const [displayText, setDisplayText] = useState(shouldAnimate ? '' : text);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayText(text);
      return;
    }
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index += 1;
      } else {
        clearInterval(interval);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay, shouldAnimate]);

  return <>{displayText}</>;
}
