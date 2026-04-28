/**
 * StatCard - Enhanced stat display for Dashboard
 * @version 7.0.0 - Count-up + sparkline + delta chip + halo
 *
 * Retro-compatible: `history` and `delta` props are optional.
 * - Without `history`: no sparkline rendered.
 * - Without `delta` (or `delta === 0`): no delta chip rendered.
 * Respects `prefers-reduced-motion`: count-up jumps to final value.
 */
import React, { useEffect, useRef, useState } from 'react';

interface StatCardProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: number;
    gradient: 'blue' | 'purple' | 'emerald' | 'amber';
    style?: React.CSSProperties;
    /** Últimos N valores (ej. 7) para sparkline. Si <2 puntos, no se dibuja. */
    history?: number[];
    /** Cambio vs. periodo anterior. >0 verde ↗, <0 rojo ↘, 0 o undefined oculta el chip. */
    delta?: number;
}

const gradientMap = {
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-pink-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500'
};

// Color del último stop por gradient — usado para sparkline & halo.
const accentMap = {
    blue: '#06B6D4',
    purple: '#EC4899',
    emerald: '#14B8A6',
    amber: '#F97316'
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** rAF count-up. Devuelve [displayValue, isCounting].
 *  Safety-net: si rAF se throttlea (background tab), un setTimeout asegura
 *  que el valor final se aplique incluso si las ticks no corren.
 */
function useCountUp(target: number, duration = 700): [number, boolean] {
    const [display, setDisplay] = useState<number>(prefersReducedMotion() ? target : 0);
    const [counting, setCounting] = useState<boolean>(false);
    const rafRef = useRef<number | null>(null);
    const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fromRef = useRef<number>(0);

    useEffect(() => {
        if (prefersReducedMotion()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- snap to final value when motion is reduced
            setDisplay(target);
            setCounting(false);
            fromRef.current = target;
            return;
        }
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        if (safetyRef.current !== null) clearTimeout(safetyRef.current);
        const start = performance.now();
        const from = fromRef.current;
        const delta = target - from;
        setCounting(true);
        const finalize = () => {
            setDisplay(target);
            setCounting(false);
            fromRef.current = target;
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const v = Math.round(from + easeOutCubic(t) * delta);
            setDisplay(v);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                finalize();
            }
        };
        rafRef.current = requestAnimationFrame(tick);
        // Safety-net: aunque rAF se throttlee (tab background), el valor
        // final se aplica via setTimeout (no se throttlea tan fuerte).
        safetyRef.current = setTimeout(finalize, duration + 100);
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            if (safetyRef.current !== null) {
                clearTimeout(safetyRef.current);
                safetyRef.current = null;
            }
        };
    }, [target, duration]);

    return [display, counting];
}

interface SparkPaths {
    line: string;
    area: string;
}

function buildSparkPath(values: number[], w = 60, h = 24, pad = 2): SparkPaths {
    if (!values || values.length < 2) return { line: '', area: '' };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => [
        pad + i * stepX,
        h - pad - ((v - min) / range) * (h - pad * 2)
    ] as [number, number]);
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L ${(w - pad).toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
    return { line, area };
}

export const StatCard: React.FC<StatCardProps> = ({
    icon: Icon,
    label,
    value,
    gradient,
    style,
    history,
    delta
}) => {
    const [display, counting] = useCountUp(value, 700);
    const accent = accentMap[gradient];
    const showSparkline = !!history && history.length > 1;
    const showDelta = typeof delta === 'number' && delta !== 0;

    const { line: sparkLine, area: sparkArea } = showSparkline
        ? buildSparkPath(history!)
        : { line: '', area: '' };

    const positive = (delta ?? 0) > 0;
    const arrow = positive ? '↗' : '↘';
    const deltaTone = positive
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : 'text-rose-700 bg-rose-50 border-rose-200';

    const ariaLabel = showDelta
        ? `${label}: ${value}, ${positive ? 'subió' : 'bajó'} ${Math.abs(delta!)} vs. anterior`
        : `${label}: ${value}`;

    return (
        <div
            className="stat-card group relative overflow-hidden"
            style={style}
            role="group"
            aria-label={ariaLabel}
        >
            {/* halo gradiente sutil — solo visible al hover */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-1/2 -right-[30%] h-[220px] w-[220px] rounded-full opacity-0 blur-[60px] transition-opacity duration-300 group-hover:opacity-30"
                style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
            />

            <div
                className={`stat-card-icon bg-gradient-to-br ${gradientMap[gradient]} transition-transform duration-300 group-hover:scale-105`}
                style={{ transitionTimingFunction: 'var(--ease-spring)' }}
            >
                <Icon size={24} className="text-white" />
            </div>

            <div className="mt-3">
                <p
                    className="text-3xl font-bold text-slate-800 tabular-nums"
                    aria-live="polite"
                    data-counting={counting ? 'true' : 'false'}
                >
                    {display}
                </p>
                <p className="text-sm text-slate-500 font-medium">{label}</p>

                {showDelta && (
                    <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${deltaTone}`}
                    >
                        {arrow} {Math.abs(delta!)} vs. anterior
                    </span>
                )}
            </div>

            {showSparkline && (
                <svg
                    viewBox="0 0 60 24"
                    width={60}
                    height={24}
                    className="absolute bottom-4 right-4 transition-opacity duration-300"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={`sc-grad-${gradient}-${value}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24">
                            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={accent} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path d={sparkArea} fill={`url(#sc-grad-${gradient}-${value})`} opacity={0.6} />
                    <path
                        d={sparkLine}
                        fill="none"
                        stroke={accent}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </div>
    );
};
