import React from 'react';

interface TrendPoint {
    value: number | string;
    date: string;
    status?: string;
}

interface TrendChartProps {
    data: TrendPoint[];
    color?: string;
    unit?: string;
    label?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, color = "#0EA5E9", unit = "", label = "" }) => {
    if (!data || data.length === 0) return null;

    // Filter and parse numeric values
    const numericPoints = data
        .map(p => ({
            ...p,
            val: typeof p.value === 'string' ? parseFloat(p.value.replace(/[^0-9.]/g, '')) : p.value
        }))
        .filter(p => !isNaN(p.val as number));

    if (numericPoints.length < 1) {
        return (
            <div className="h-[100px] flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200">
                <span className="text-xs text-slate-400">Non-numeric data ({data[0].value})</span>
            </div>
        );
    }

    const values = numericPoints.map(p => p.val as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.2;

    const chartMin = min - padding;
    const chartMax = max + padding;
    const chartRange = chartMax - chartMin;

    const width = 500;
    const height = 100;

    const getX = (index: number) => (index / (numericPoints.length - 1 || 1)) * width;
    const getY = (val: number) => height - ((val - chartMin) / chartRange) * height;

    const points = numericPoints.map((p, i) => `${getX(i)},${getY(p.val as number)}`).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    // Get latest and first values for the summary
    const latest = numericPoints[numericPoints.length - 1];
    const first = numericPoints[0];
    const diff = (latest.val as number) - (first.val as number);
    const isImproving = diff < 0; // Usually lower is better for medical markers (glucose, ldl, etc)

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {label} {unit && <span className="text-xs font-normal text-slate-500">({unit})</span>}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${latest.status === 'warning' || latest.status === 'critical' || latest.status === 'high' || latest.status === 'low'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    {latest.status || 'Normal'}
                </span>
            </div>

            <div className="h-[120px] relative mt-4">
                <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={`trend-grad-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area under curve */}
                    <polyline
                        points={areaPoints}
                        fill={`url(#trend-grad-${label})`}
                        stroke="none"
                    />

                    {/* Line */}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Dots */}
                    {numericPoints.map((p, i) => (
                        <circle
                            key={i}
                            cx={getX(i)}
                            cy={getY(p.val as number)}
                            r="4"
                            fill="white"
                            stroke={color}
                            strokeWidth="2"
                        />
                    ))}
                </svg>
            </div>

            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                <span>{new Date(first.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                <span>{new Date(latest.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            </div>

            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {label} changed from <span className="font-bold text-slate-900 dark:text-white">{first.val} {unit}</span> to <span className="font-bold text-slate-900 dark:text-white">{latest.val} {unit}</span>.
                    {numericPoints.length > 1 && (
                        <span className="ml-1 text-niraiva-600">
                            {diff > 0 ? ' ↑ ' : ' ↓ '}
                            {Math.abs(diff).toFixed(1)} {unit} change ({((Math.abs(diff) / (first.val as number || 1)) * 100).toFixed(1)}%)
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
};
