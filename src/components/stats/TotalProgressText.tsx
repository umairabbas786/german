import { TypewriterText } from '../shared/TypewriterText';

export interface TotalProgressTextProps {
  percent: number;
  delay?: number;
}

export function TotalProgressText({ percent, delay = 50 }: TotalProgressTextProps) {
  return (
    <TypewriterText
      text={`Total Progress: ${percent}%`}
      delay={delay}
      shouldAnimate
      wordByWord={false}
    />
  );
}
