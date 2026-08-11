export interface SpiderPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface SpiderData {
  axisPoints: SpiderPoint[];
  dataPoints: SpiderPoint[];
  polygon: string;
}

export function buildSpiderData(
  topics: string[],
  values: number[],
  defaultValue = 0,
): SpiderData {
  const centerX = 200;
  const centerY = 200;
  const radius = 140;
  const axisPoints = topics.map((label, index) => {
    const angle = (360 / topics.length) * index - 90;
    const radians = (angle * Math.PI) / 180;
    return {
      x: centerX + Math.cos(radians) * radius,
      y: centerY + Math.sin(radians) * radius,
      value: values[index] ?? defaultValue,
      label,
    };
  });
  const dataPoints = axisPoints.map((point, index) => {
    const value = values[index] ?? defaultValue;
    const ratio = Math.max(0, Math.min(1, value / 100));
    return {
      x: centerX + (point.x - centerX) * ratio,
      y: centerY + (point.y - centerY) * ratio,
      value,
      label: point.label,
    };
  });
  return {
    axisPoints,
    dataPoints,
    polygon: dataPoints.map((point) => `${point.x},${point.y}`).join(' '),
  };
}
