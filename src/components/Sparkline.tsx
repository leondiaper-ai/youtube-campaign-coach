type Point = { x: number; y: number };

export default function Sparkline({
  data,
  width = 160,
  height = 40,
  stroke = '#0E0E0E',
  fill = 'rgba(14,14,14,0.06)',
}: {
  data: Point[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-ink/35"
        style={{ width, height, display: 'flex', alignItems: 'center' }}
      >
        no history yet
      </div>
    );
  }
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad = 2;
  const toX = (x: number) => pad + ((x - minX) / rangeX) * (width - pad * 2);
  const toY = (y: number) => height - pad - ((y - minY) / rangeY) * (height - pad * 2);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.x)},${toY(d.y)}`).join(' ');
  const area =
    `M${toX(data[0].x)},${height - pad} ` +
    data.map((d) => `L${toX(d.x)},${toY(d.y)}`).join(' ') +
    ` L${toX(data[data.length - 1].x)},${height - pad} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={fill} stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
