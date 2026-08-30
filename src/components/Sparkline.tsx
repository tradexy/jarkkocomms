type Props = {
  values: number[];
  up: boolean;
};

export function Sparkline({ values, up }: Props) {
  if (values.length < 2) return <svg className="spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 88;
  const height = 32;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={up ? "#6fbf7e" : "#e05d4c"}
        strokeWidth="1.8"
        points={points}
      />
    </svg>
  );
}
