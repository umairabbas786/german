import { useEffect, useRef, useState } from 'react';

export interface WritingTypewriterProps {
  text: string;
  delay?: number;
  shouldAnimate?: boolean;
}

export function WritingTypewriter({ text: rawText, delay = 40, shouldAnimate = true }: WritingTypewriterProps) {
  const text = rawText.replace(/\\n/g, '\n');
  const [displayText, setDisplayText] = useState(shouldAnimate ? '' : text);
  const textRef = useRef(text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayText(text);
      textRef.current = text;
      indexRef.current = 0;
      return;
    }
    setDisplayText('');
    textRef.current = text;
    indexRef.current = 0;
    const interval = setInterval(() => {
      const currentText = textRef.current;
      const currentIndex = indexRef.current;
      if (currentIndex < currentText.length) {
        setDisplayText(currentText.slice(0, currentIndex + 1));
        indexRef.current = currentIndex + 1;
      } else {
        clearInterval(interval);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay, shouldAnimate]);

  return <>{displayText}</>;
}
