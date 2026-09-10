import { formatMoney } from "@/lib/utils";

type Point = { label: string; fullLabel: string; amount: number };

const BLUE = "#7a2456";
const HEIGHT = 160;
const TOP_PADDING = 24;
const BAR_MAX_WIDTH = 24;
const GAP = 2;
const TARGET_WIDTH = 700;

export function SalesTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">Aucune donnée sur cette période.</p>;
  }

  const max = Math.max(...data.map((d) => d.amount), 1);
  const n = data.length;
  const barWidth = Math.max(2, Math.min(BAR_MAX_WIDTH, TARGET_WIDTH / n - GAP));
  const width = n * (barWidth + GAP);
  const peakIndex = data.reduce((best, d, i) => (d.amount > data[best].amount ? i : best), 0);
  const lastIndex = n - 1;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Évolution des ventes sur la période"
      >
        {/* baseline */}
        <line x1={0} y1={HEIGHT - 20} x2={width} y2={HEIGHT - 20} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((d, i) => {
          const barHeight = Math.max(1, ((HEIGHT - 20 - TOP_PADDING) * d.amount) / max);
          const x = i * (barWidth + GAP);
          const y = HEIGHT - 20 - barHeight;
          const showLabel = i === peakIndex || i === lastIndex;
          return (
            <g key={i}>
              <title>{`${d.fullLabel} : ${formatMoney(d.amount)}`}</title>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={2} fill={BLUE} opacity={i === lastIndex ? 1 : 0.85} />
              {showLabel && d.amount > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#475569"
                  className="tabular-nums"
                >
                  {Math.round(d.amount / 1000)}k
                </text>
              )}
              {(i === 0 || i === lastIndex || i === Math.floor(n / 2)) && (
                <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
