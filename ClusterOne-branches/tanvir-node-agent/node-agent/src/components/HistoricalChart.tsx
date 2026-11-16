import React, { useState } from 'react';
import { TimeSeriesPoint, TimeRange } from '../types';

interface HistoricalChartProps {
  title: string;
  unit: string;
  dataKey: keyof TimeSeriesPoint;
  points: TimeSeriesPoint[];
  color: string;
  range: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  maxValue?: number;
  thresholdValue?: number;
  thresholdLabel?: string;
}

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  title,
  unit,
  dataKey,
  points,
  color,
  range,
  onRangeChange,
  maxValue,
  thresholdValue,
  thresholdLabel,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);

  if (!points || points.length === 0) {
    return (
      <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">{title}</div>
          {onRangeChange && (
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {(['5m', '1h', '6h', '24h', '7d'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => onRangeChange(r)}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    range === r ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-44 flex flex-col items-center justify-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800/80 rounded-lg">
          <span>No telemetry recorded for this period.</span>
          <span className="text-[10px] text-zinc-600 mt-1">Collecting live metrics every 1s</span>
        </div>
      </div>
    );
  }

  // Calculate bounds
  const values = points.map((p) => Number(p[dataKey]) || 0);
  const minVal = 0;
  const computedMax = Math.max(...values, thresholdValue || 0, 10);
  const maxVal = maxValue !== undefined ? maxValue : computedMax * 1.15;

  const width = 600;
  const height = 160;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Generate SVG path points
  const coords = points.map((p, i) => {
    const x = paddingLeft + (i / Math.max(1, points.length - 1)) * plotWidth;
    const val = Number(p[dataKey]) || 0;
    const normalizedY = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
    const y = paddingTop + plotHeight - normalizedY * plotHeight;
    return { x, y, point: p, val };
  });

  const lineD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
  const areaD = coords.length > 0 
    ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} Z`
    : '';

  // Threshold line coordinate
  const thresholdY = thresholdValue !== undefined && maxVal > minVal
    ? paddingTop + plotHeight - ((thresholdValue - minVal) / (maxVal - minVal)) * plotHeight
    : null;

  const latestVal = values[values.length - 1];

  return (
    <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-4 space-y-3">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">{title}</span>
          <span className="text-sm font-mono font-bold text-white">
            {latestVal.toFixed(1)} <span className="text-xs font-normal text-zinc-500">{unit}</span>
          </span>
        </div>

        {onRangeChange && (
          <div className="flex items-center gap-1 text-[11px] font-mono bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
            {(['5m', '1h', '6h', '24h', '7d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  range === r ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SVG Chart Area */}
      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-44 overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + plotHeight * ratio;
            const gridVal = maxVal - ratio * (maxVal - minVal);
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#71717a"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Threshold Line if configured */}
          {thresholdY !== null && thresholdY >= paddingTop && thresholdY <= paddingTop + plotHeight && (
            <g>
              <line
                x1={paddingLeft}
                y1={thresholdY}
                x2={width - paddingRight}
                y2={thresholdY}
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
              <text
                x={width - paddingRight}
                y={thresholdY - 4}
                textAnchor="end"
                fill="#f43f5e"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {thresholdLabel || `Limit: ${thresholdValue} ${unit}`}
              </text>
            </g>
          )}

          {/* Area fill */}
          {areaD && (
            <path
              d={areaD}
              fill={`url(#grad-${title.replace(/\s+/g, '-')})`}
            />
          )}

          {/* Primary data path */}
          {lineD && (
            <path
              d={lineD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points / Hover Hit Targets */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={hoveredPoint === c.point ? 4.5 : 2}
              fill={hoveredPoint === c.point ? '#ffffff' : color}
              stroke="#09090b"
              strokeWidth="1.5"
              className="cursor-crosshair transition-all"
              onMouseEnter={() => setHoveredPoint(c.point)}
            />
          ))}

          {/* Time axis labels */}
          {coords.length > 0 && (
            <>
              <text
                x={coords[0].x}
                y={height - 5}
                textAnchor="start"
                fill="#71717a"
                fontSize="9"
                fontFamily="monospace"
              >
                {coords[0].point.timeStr}
              </text>
              <text
                x={coords[coords.length - 1].x}
                y={height - 5}
                textAnchor="end"
                fill="#71717a"
                fontSize="9"
                fontFamily="monospace"
              >
                {coords[coords.length - 1].point.timeStr}
              </text>
            </>
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded shadow-lg text-[11px] font-mono text-white pointer-events-none">
            <span className="text-zinc-400">{hoveredPoint.timeStr}: </span>
            <span className="font-bold">{Number(hoveredPoint[dataKey]).toFixed(1)} {unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};
