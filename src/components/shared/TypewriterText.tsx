import { useEffect, useState } from 'react';

export interface TypewriterTextProps {
  text: string;
  delay?: number;
  startDelay?: number;
  shouldAnimate?: boolean;
  wordByWord?: boolean;
}

export function TypewriterText({
  text,
  delay = 50,
  startDelay = 0,
  shouldAnimate = true,
  wordByWord = false,
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState(shouldAnimate ? '' : text);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayText(text);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    if (wordByWord) {
      const words = text.split(' ');
      let i = 0;
      const typeWord = () => {
        if (i < words.length) {
          setDisplayText(words.slice(0, i + 1).join(' '));
          i++;
          timeoutId = setTimeout(typeWord, delay * 3);
        }
      };
      const initial = setTimeout(typeWord, startDelay);
      return () => {
        clearTimeout(initial);
        clearTimeout(timeoutId);
      };
    }

    const startTyping = () => {
      let i = 0;
      const typeChar = () => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
          timeoutId = setTimeout(typeChar, delay);
        }
      };
      timeoutId = setTimeout(typeChar, delay);
    };
    const initial = setTimeout(startTyping, startDelay);
    return () => {
      clearTimeout(initial);
      clearTimeout(timeoutId);
    };
  }, [text, delay, startDelay, shouldAnimate, wordByWord]);

  return <>{displayText}</>;
}
