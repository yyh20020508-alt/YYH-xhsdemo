import dynamic from 'next/dynamic';
import {useState, useRef, useCallback, useEffect} from 'react';
import Head from 'next/head';
import {useNewAppTheme} from '@/hooks/useNewAppTheme';
import {useNewAppLog} from '@/hooks/useNewAppLog';
import {NewAppTopBar} from '@/components/NewAppTopBar';
import {NewAppFooterButton} from '@/components/NewAppFooterButton';
import {NewAppBridge} from '@/lib/newapp-bridge';
import styles from '@/styles/destiny-chart.module.css';
import DATA from '@/config/destiny-chart-data.json';
import {
    PROV_CITIES,
    STEMS,
    BRANCHES,
    S_EL,
    B_EL,
    EL,
    EC,
    EA,
    GEN_MAP,
    CTRL_MAP,
    HIDDEN_STEMS,
    clamp,
    sd,
    getPillars,
    getProfile,
    getElSum,
    getDM,
    getDaYun,
    getNarr,
    buildLine,
    buildMainKline,
    analyzeTL,
    buildDimScores,
    buildMonthWealth,
    buildMonthLove,
    buildMonthCareer,
    getRadarData,
    stgL,
    stgT,
    bandL,
    bandLA,
    generate,
    getBaziYear,
    getMonthStem,
    type ReadingData,
    type LinePt,
    type KlinePt,
    type DimScores
} from '@/lib/destiny-chart-utils';

/* helper: DimScores → indexable */
function ds(scores: DimScores): Record<string, number> {
    return scores as unknown as Record<string, number>;
}

/* ══════ Chart config ══════ */
const DEFAULT_GAP = 11;
const MIN_GAP = 6;
const MAX_GAP = 18;
const CH = 310;
const PAD = {top: 34, right: 18, bottom: 34, left: 40};

const DIMS = DATA.dims as {key: string; label: string; color: [string, string]; track: string}[];

/* ══════ dimQuip (from JSON + age-aware) ══════ */
function getAgeStage(age: number): string {
    if (age <= 3) {
        return 'baby';
    }
    if (age <= 6) {
        return 'preschool';
    }
    if (age <= 12) {
        return 'primary';
    }
    if (age <= 18) {
        return 'teen';
    }
    if (age <= 30) {
        return 'young';
    }
    if (age <= 45) {
        return 'prime';
    }
    if (age <= 60) {
        return 'mature';
    }
    return 'senior';
}

function dimQuip(key: string, score: number, age: number): string {
    const stage = getAgeStage(age);
    const quips = (DATA.dimQuips as unknown as Record<string, Record<string, [number, string][]>>)[stage];
    if (!quips) {
        return '';
    }
    const list = quips[key];
    if (!list) {
        return '';
    }
    for (const [th, txt] of list) {
        if (score >= th) {
            return txt;
        }
    }
    return list[list.length - 1]?.[1] || '';
}

/* ══════ Canvas helpers (pure draw fns) ══════ */
function yOf(s: number, h: number) {
    return h - PAD.bottom - ((s - 50) / 55) * (h - PAD.top - PAD.bottom);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    [55, 65, 75, 85, 98].forEach(t => {
        const y = yOf(t, h);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(w - PAD.right, y);
        ctx.stroke();
    });
}

function drawSmooth(ctx: CanvasRenderingContext2D, pts: {x: number; y: number}[]) {
    if (pts.length < 2) {
        return;
    }
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
        return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)],
            p1 = pts[i],
            p2 = pts[i + 1],
            p3 = pts[Math.min(pts.length - 1, i + 2)],
            t = 0.25;
        ctx.bezierCurveTo(
            p1.x + (p2.x - p0.x) * t,
            p1.y + (p2.y - p0.y) * t,
            p2.x - (p3.x - p1.x) * t,
            p2.y - (p3.y - p1.y) * t,
            p2.x,
            p2.y
        );
    }
}

/* ══════ Component ══════ */
function DestinyChart() {
    const {isDark} = useNewAppTheme();
    const {log, setPage: setLogPage} = useNewAppLog({pageName: 'new_agent_detail', agentName: DATA.page.agentName});

    // Form state
    const [name, setName] = useState('未命名');
    const [gender, setGender] = useState<'female' | 'male'>('female');
    const [birthDate, setBirthDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const [birthTime, setBirthTime] = useState(() => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    });
    const timeInputRef = useRef<HTMLInputElement>(null);
    const [province, setProvince] = useState('北京');
    const [city, setCity] = useState('北京');
    const [cityName, setCityName] = useState('北京');

    // Result state
    const [reading, setReading] = useState<ReadingData | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [selAge, setSelAge] = useState(0);
    const [selYear, setSelYear] = useState(0);
    const [selScore, setSelScore] = useState(0);
    const [activeSection, setActiveSection] = useState('summary');
    const [dashboardTab, setDashboardTab] = useState<'life' | 'year' | 'profile'>('life');
    const [chartMode, setChartMode] = useState<'kline' | 'line'>('kline');
    const [pointGap, setPointGap] = useState(DEFAULT_GAP);

    // Refs
    // Share state
    const [showShareOverlay, setShowShareOverlay] = useState(false);
    const [shareSaving, setShareSaving] = useState(false);

    // Refs
    const chartRef = useRef<HTMLCanvasElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLCanvasElement>(null);
    const radarRef = useRef<HTMLCanvasElement>(null);
    const wealthRef = useRef<HTMLCanvasElement>(null);
    const readingRef = useRef<HTMLDivElement>(null);
    const shareCanvasRef = useRef<HTMLCanvasElement>(null);
    const shareKindRef = useRef<'life' | 'year'>('year');
    const pointGapRef = useRef(DEFAULT_GAP);

    // Derived cities
    const cities = PROV_CITIES.find(([p]) => p === province)?.[1] || [];

    /* ── Chart width calc ── */
    const chartW = useCallback(
        (len: number) => {
            return Math.max(360, PAD.left + PAD.right + Math.max(1, len - 1) * pointGap);
        },
        [pointGap]
    );

    /* ── Sync pointGapRef with state (used in non-reactive touch handlers) ── */
    useEffect(() => {
        pointGapRef.current = pointGap;
    }, [pointGap]);

    /* ── Pinch-to-zoom on chart ── */
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !showResult) {
            return;
        }
        let startDist = 0;
        let startGap = DEFAULT_GAP;

        const getDist = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        };

        const onStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                startDist = getDist(e.touches);
                startGap = pointGapRef.current;
            }
        };

        const onMove = (e: TouchEvent) => {
            if (e.touches.length !== 2) {
                return;
            }
            e.preventDefault();
            const ratio = getDist(e.touches) / startDist;
            const next = Math.round(Math.min(MAX_GAP, Math.max(MIN_GAP, startGap * ratio)));
            if (next !== pointGapRef.current) {
                setPointGap(next);
            }
        };

        el.addEventListener('touchstart', onStart, {passive: true});
        el.addEventListener('touchmove', onMove, {passive: false});
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
        };
    }, [showResult]);

    /* ── Draw main chart ── */
    const drawChart = useCallback(() => {
        if (!reading || !chartRef.current) {
            return;
        }
        const canvas = chartRef.current;
        const series = reading.charts.line;
        const kline = reading.charts.kline;
        const dw = chartW(series.length);
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        canvas.width = Math.round(dw * dpr);
        canvas.height = Math.round(CH * dpr);
        canvas.style.width = `${dw}px`;
        canvas.style.height = `${CH}px`;
        const wrapEl = canvas.parentElement;
        if (wrapEl) {
            wrapEl.style.width = `${dw}px`;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const step = (dw - PAD.left - PAD.right) / Math.max(1, series.length - 1);
        ctx.clearRect(0, 0, dw, CH);
        drawGrid(ctx, dw, CH);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px -apple-system,sans-serif';
        // X-axis ticks
        const count = Math.max(6, Math.min(16, Math.floor(dw / 50)));
        const every = Math.max(1, Math.round(series.length / count));
        for (let i = 0; i < series.length; i += every) {
            ctx.fillText(String(series[i].age), PAD.left + step * i - 6, CH - 14);
        }
        if (series.length > 0) {
            const last = series[series.length - 1];
            ctx.fillText(String(last.age), PAD.left + step * (series.length - 1) - 6, CH - 14);
        }
        // Axes
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, PAD.top);
        ctx.lineTo(PAD.left, CH - PAD.bottom);
        ctx.lineTo(dw - PAD.right, CH - PAD.bottom);
        ctx.stroke();

        // Lifetime average reference line
        const average = series.reduce((sum, item) => sum + item.score, 0) / Math.max(1, series.length);
        const avgY = yOf(average, CH);
        ctx.save();
        ctx.strokeStyle = 'rgba(91,99,122,.34)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(PAD.left, avgY);
        ctx.lineTo(dw - PAD.right, avgY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#7f8798';
        ctx.font = '9px -apple-system,sans-serif';
        ctx.fillText(`人生均值 ${Math.round(average)}`, PAD.left + 6, avgY - 6);
        ctx.restore();

        // Current age dashed line
        const curIdx = series.findIndex(i => i.age === reading.meta.curA);
        if (curIdx >= 0) {
            const cx = PAD.left + step * curIdx;
            ctx.save();
            ctx.strokeStyle = 'rgba(79,70,229,0.18)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(cx, PAD.top);
            ctx.lineTo(cx, CH - PAD.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(79,70,229,0.6)';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('今年', cx - 10, PAD.top - 6);
            ctx.restore();
        }

        // Selected dashed line
        const si = Math.max(
            0,
            series.findIndex(i => i.age === selAge)
        );
        const sx = PAD.left + step * si;
        ctx.strokeStyle = 'rgba(79,70,229,0.25)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, PAD.top);
        ctx.lineTo(sx, CH - PAD.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        if (chartMode === 'kline') {
            const bw = Math.max(1.5, Math.min(8, step * 0.46));
            const cs = getComputedStyle(document.documentElement);
            const cRise = cs.getPropertyValue('--rise')?.trim() || '#dc2626';
            const cFall = cs.getPropertyValue('--fall')?.trim() || '#16a34a';
            kline.forEach((k, i) => {
                const x = PAD.left + step * i;
                const oY = yOf(k.open, CH),
                    cY = yOf(k.close, CH),
                    hY = yOf(k.high, CH),
                    lY = yOf(k.low, CH);
                const up = k.close >= k.open;
                const c = up ? cRise : cFall;
                ctx.beginPath();
                ctx.moveTo(x, hY);
                ctx.lineTo(x, lY);
                ctx.strokeStyle = c;
                ctx.lineWidth = 1;
                ctx.stroke();
                const top = Math.min(oY, cY),
                    bodyH = Math.max(1, Math.abs(oY - cY));
                ctx.fillStyle = c;
                ctx.fillRect(x - bw / 2, top, bw, bodyH);
            });
            const ac = series[si];
            ctx.fillStyle = '#4f46e5';
            ctx.font = 'bold 11px -apple-system,sans-serif';
            ctx.fillText(`${ac.age}岁 ${ac.score}分`, Math.max(44, sx - 20), yOf(ac.score, CH) - 14);
        } else {
            const pts = series.map((it, i) => ({x: PAD.left + step * i, y: yOf(it.score, CH)}));
            const grad = ctx.createLinearGradient(0, PAD.top, 0, CH - PAD.bottom);
            grad.addColorStop(0, 'rgba(99,102,241,0.22)');
            grad.addColorStop(0.5, 'rgba(129,140,248,0.10)');
            grad.addColorStop(1, 'rgba(246,247,251,0)');
            ctx.beginPath();
            drawSmooth(ctx, pts);
            ctx.lineTo(pts[pts.length - 1].x, CH - PAD.bottom);
            ctx.lineTo(pts[0].x, CH - PAD.bottom);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.save();
            ctx.shadowColor = 'rgba(99,102,241,0.35)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            drawSmooth(ctx, pts);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
            const dotEvery = Math.max(1, Math.round(series.length / 10));
            pts.forEach((p, i) => {
                if (i % dotEvery !== 0 && i !== si) {
                    return;
                }
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, i === si ? 5 : 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#6366f1';
                ctx.beginPath();
                ctx.arc(p.x, p.y, i === si ? 3 : 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
            const ac = series[si];
            ctx.fillStyle = '#4f46e5';
            ctx.font = 'bold 11px -apple-system,sans-serif';
            ctx.fillText(`${ac.age}岁 ${ac.score}分`, Math.max(44, sx - 20), yOf(ac.score, CH) - 14);
        }


        // Mark the highest and lowest points for quick scanning.
        const highIndex = series.reduce((best, item, index) => item.score > series[best].score ? index : best, 0);
        const lowIndex = series.reduce((best, item, index) => item.score < series[best].score ? index : best, 0);
        [
            {index: highIndex, label: '高点', color: '#e59b24', offset: -12},
            {index: lowIndex, label: '低点', color: '#28b8ad', offset: 18}
        ].forEach(mark => {
            const item = series[mark.index];
            const x = PAD.left + step * mark.index;
            const y = yOf(item.score, CH);
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = mark.color;
            ctx.font = 'bold 9px -apple-system,sans-serif';
            ctx.fillText(`${mark.label} ${item.score}`, Math.max(PAD.left, x - 18), y + mark.offset);
        });
    }, [reading, selAge, chartMode, pointGap, chartW]);

    /* ── Draw ring chart ── */
    const drawRingChart = useCallback(
        (scores: DimScores) => {
            const canvas = ringRef.current;
            if (!canvas) {
                return;
            }
            const container = canvas.parentElement;
            const size = Math.round(container?.clientWidth || 150);
            const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
            canvas.width = Math.round(size * dpr);
            canvas.height = Math.round(size * dpr);
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);
            const cx = size / 2,
                cy = size / 2,
                scale = size / 150;
            const centerR = 28 * scale,
                outerR = cx - 6 * scale,
                gap = 3 * scale,
                totalGap = gap * 3;
            const bandBudget = outerR - centerR - totalGap;
            const ratios = [1.3, 1.15, 1, 0.9],
                rSum = ratios.reduce((a, b) => a + b, 0);
            const widths = ratios.map(rt => Math.max(4, (bandBudget * rt) / rSum));
            const radii: number[] = [];
            let r = outerR;
            for (let i = 0; i < 4; i++) {
                radii.push(r - widths[i] / 2);
                r -= widths[i] + (i < 3 ? gap : 0);
            }
            const startA = -Math.PI / 2;
            DIMS.forEach((dim, i) => {
                const ri = radii[i],
                    w = widths[i];
                const score = ds(scores)[dim.key] as number;
                const endA = startA + (score / 100) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(cx, cy, ri, 0, Math.PI * 2);
                ctx.strokeStyle = dim.track;
                ctx.lineWidth = w;
                ctx.lineCap = 'round';
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, ri, startA, endA);
                ctx.strokeStyle = dim.color[0];
                ctx.lineWidth = w;
                ctx.lineCap = 'round';
                ctx.stroke();
            });
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.round(28 * scale)}px -apple-system,sans-serif`;
            ctx.fillStyle = isDark ? '#e5e7eb' : '#1c1c1e';
            ctx.fillText(String(scores.total), cx, cy - 2 * scale);
            ctx.font = `500 ${Math.round(10 * scale)}px -apple-system,sans-serif`;
            ctx.fillStyle = '#aeaeb2';
            ctx.fillText('总分', cx, cy + 16 * scale);
        },
        [isDark]
    );

    /* ── Draw radar chart ── */
    const drawRadarChart = useCallback(() => {
        const canvas = radarRef.current;
        if (!canvas || !reading) {
            return;
        }
        const data = reading.radarData;
        const container = canvas.parentElement;
        const size = container?.clientWidth || 280;
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        const cx = size / 2,
            cy = size / 2,
            maxR = size * 0.34,
            n = data.length,
            stepA = (Math.PI * 2) / n,
            sa = -Math.PI / 2;
        const ptAt = (i: number, r: number) => [cx + Math.cos(sa + stepA * i) * r, cy + Math.sin(sa + stepA * i) * r];
        [25, 50, 75, 100].forEach(lv => {
            const rv = maxR * (lv / 100);
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const [px, py] = ptAt(i % n, rv);
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = lv === 100 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        for (let i = 0; i < n; i++) {
            const [px, py] = ptAt(i, maxR);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.beginPath();
        data.forEach((d, i) => {
            const rv = maxR * (d.value / 100);
            const [px, py] = ptAt(i, rv);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(79,70,229,0.12)';
        ctx.fill();
        ctx.beginPath();
        data.forEach((d, i) => {
            const rv = maxR * (d.value / 100);
            const [px, py] = ptAt(i, rv);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = 'rgba(79,70,229,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        data.forEach((d, i) => {
            const rv = maxR * (d.value / 100);
            const [px, py] = ptAt(i, rv);
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#4f46e5';
            ctx.fill();
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        data.forEach((d, i) => {
            const [lx, ly] = ptAt(i, maxR + 20);
            ctx.font = 'bold 12px -apple-system,sans-serif';
            ctx.fillStyle = isDark ? '#e5e7eb' : '#111827';
            ctx.fillText(d.label, lx, ly - 7);
            ctx.font = '11px -apple-system,sans-serif';
            ctx.fillStyle = '#4f46e5';
            ctx.fillText(String(d.value), lx, ly + 8);
        });
    }, [reading, isDark]);

    /* ── Draw wealth month K-line chart ── */
    const drawWealthChart = useCallback((monthData: {month: number; score: number}[], target?: HTMLCanvasElement | null) => {
        const canvas = target || wealthRef.current;
        if (!canvas) {
            return;
        }
        const container = canvas.parentElement;
        const w = container?.clientWidth || 340,
            h = 160;
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const pad = {top: 20, right: 14, bottom: 28, left: 32};
        const plotW = w - pad.left - pad.right,
            plotH = h - pad.top - pad.bottom;
        const klines = monthData.map((d, i) => {
            const close = d.score;
            const open = i === 0 ? close - 1 + sd(d.month, close) * 2 - 1 : monthData[i - 1].score;
            const body = Math.abs(close - open);
            const ext = Math.max(1, Math.round(body * 0.4 + sd(d.month * 7, close * 3) * 2));
            return {
                month: d.month,
                open,
                close,
                high: Math.min(98, Math.max(open, close) + ext),
                low: Math.max(55, Math.min(open, close) - ext),
                score: d.score
            };
        });
        const allVals = klines.flatMap(k => [k.high, k.low]);
        const minS = Math.min(...allVals) - 2,
            maxS = Math.max(...allVals) + 2,
            range = Math.max(1, maxS - minS);
        const colW = plotW / 12;
        const xOf = (i: number) => pad.left + colW * i + colW / 2;
        const yOf2 = (s: number) => pad.top + plotH - ((s - minS) / range) * plotH;
        const barW = Math.max(4, Math.min(16, colW * 0.5));
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
        }
        let bestI = 0,
            worstI = 0;
        klines.forEach((k, i) => {
            if (k.close > klines[bestI].close) {
                bestI = i;
            }
            if (k.close < klines[worstI].close) {
                worstI = i;
            }
        });
        klines.forEach((k, i) => {
            const x = xOf(i);
            const rise = k.close >= k.open;
            const fillC = rise ? '#dc2626' : '#16a34a';
            ctx.strokeStyle = fillC;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, yOf2(k.high));
            ctx.lineTo(x, yOf2(k.low));
            ctx.stroke();
            const bodyTop = yOf2(Math.max(k.open, k.close)),
                bodyBot = yOf2(Math.min(k.open, k.close));
            const bodyH = Math.max(1.5, bodyBot - bodyTop);
            ctx.fillStyle = fillC;
            ctx.fillRect(x - barW / 2, bodyTop, barW, bodyH);
            if (i === bestI || i === worstI) {
                ctx.font = 'bold 10px -apple-system,sans-serif';
                ctx.fillStyle = i === bestI ? '#16a34a' : '#dc2626';
                ctx.textAlign = 'center';
                const ly = yOf2(k.high) - 8;
                ctx.fillText(String(k.close), x, ly < pad.top + 6 ? yOf2(k.low) + 14 : ly);
            }
        });
        ctx.font = '10px -apple-system,sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        klines.forEach((k, i) => ctx.fillText(k.month + '月', xOf(i), h - 8));
        ctx.textAlign = 'right';
        ctx.font = '9px -apple-system,sans-serif';
        [Math.round(minS + 1), Math.round(minS + range / 2), Math.round(maxS - 1)].forEach(t =>
            ctx.fillText(String(t), pad.left - 4, yOf2(t) + 3)
        );
    }, []);

    /* ── Handle chart click ── */
    const handleChartClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!reading || !chartRef.current) {
                return;
            }
            const rect = chartRef.current.getBoundingClientRect();
            const series = reading.charts.line;
            const dw = chartW(series.length);
            const x = ((e.clientX - rect.left) / rect.width) * dw;
            const step = (dw - PAD.left - PAD.right) / Math.max(1, series.length - 1);
            const tol = Math.max(10, step * 0.6);
            let idx = -1;
            if (chartMode === 'kline') {
                const kl = reading.charts.kline;
                const bw = Math.max(1.5, Math.min(8, step * 0.46));
                for (let i = 0; i < kl.length; i++) {
                    if (Math.abs(x - (PAD.left + step * i)) <= Math.max(8, bw + 4)) {
                        idx = i;
                        break;
                    }
                }
                if (idx < 0) {
                    for (let i = 0; i < series.length; i++) {
                        if (Math.abs(x - (PAD.left + step * i)) <= tol) {
                            idx = i;
                            break;
                        }
                    }
                }
            } else {
                for (let i = 0; i < series.length; i++) {
                    if (Math.abs(x - (PAD.left + step * i)) <= tol) {
                        idx = i;
                        break;
                    }
                }
            }
            if (idx < 0) {
                return;
            }
            const p = series[idx];
            setSelAge(p.age);
            setSelYear(p.year);
            setSelScore(p.score);
            log('click', 'new_agent', {action_type: 'button_click'});
        },
        [reading, chartMode, chartW, log]
    );

    /* ── Generate reading ── */
    const handleGenerate = useCallback(() => {
        if (!birthDate || !birthTime) {
            NewAppBridge.toast.error('请填写出生日期和时间');
            return;
        }
        const [yv, mv, dv] = birthDate.split('-').map(Number);
        if (!yv || !mv || !dv) {
            NewAppBridge.toast.error('日期格式不正确');
            return;
        }
        log('click', 'new_agent', {action_type: 'form_submit', has_text_input: 1});
        const rd = generate({
            name: name || '未命名',
            g: gender,
            bd: birthDate,
            bt: birthTime,
            bp: city,
            bpName: cityName
        });
        setReading(rd);
        setSelAge(rd.meta.curA);
        setSelYear(rd.charts.line.find(i => i.age === rd.meta.curA)?.year || 0);
        setSelScore(rd.meta.score);
        setActiveSection('summary');
        setDashboardTab('life');
        setChartMode('kline');
        setPointGap(DEFAULT_GAP);
        setShowResult(true);
        log('show', 'new_agent_result', {}, 'new_agent_detail');
        window.scrollTo({top: 0, behavior: 'smooth'});
    }, [name, gender, birthDate, birthTime, city, cityName, log, setLogPage]);

    /* ── Back to form ── */
    const handleBack = useCallback(() => {
        log('click', 'new_agent', {action_type: 'retry'});
        setShowResult(false);
        setLogPage('new_agent_detail');
        window.scrollTo({top: 0, behavior: 'smooth'});
    }, [log]);

    /* ── Draw share canvas ── */
    const drawShareCanvas = useCallback(() => {
        if (!reading || !shareCanvasRef.current) {
            return;
        }
        const cv = shareCanvasRef.current;
        const pt =
            reading.charts.line.find(i => i.age === selAge) || reading.charts.line[reading.charts.line.length - 1];
        const uname = (reading.name || '未命名') + '的人生数据看板';
        const getGrade = (sc: number) => {
            if (sc >= 92) {
                return '天命之年';
            }
            if (sc >= 85) {
                return '顺势而为';
            }
            if (sc >= 78) {
                return '稳中有进';
            }
            if (sc >= 70) {
                return '平淡积累';
            }
            return '蓄势待发';
        };
        const grade = getGrade(pt.score);
        const DS = buildDimScores(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const DSR = ds(DS);
        const mC = buildMonthCareer(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const mL = buildMonthLove(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const mW = buildMonthWealth(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const a = pt.age,
            yr = pt.year,
            sc = pt.score;
        const hi = DIMS.reduce((best, d) => ((DSR[d.key] as number) >= (DSR[best.key] as number) ? d : best));
        const lo = DIMS.reduce((best, d) => ((DSR[d.key] as number) <= (DSR[best.key] as number) ? d : best));
        const selectedBrief = reading.yearBriefs.find(item => item.age === a)?.text || '';
        const insTitle = `✦ ${yr}年度解读`;
        const insParas = [selectedBrief];

        // Career phases
        const cScores = mC.map(d => d.score);
        const cAvg = cScores.reduce((acc, v) => acc + v, 0) / 12;
        const cMax = Math.max(...cScores),
            cMin = Math.min(...cScores);
        const cHi = cAvg + (cMax - cAvg) * 0.45,
            cLo = cAvg - (cAvg - cMin) * 0.45;
        const cPhaseOf = (v: number) =>
            v >= cHi + 3 ? 'peak' : v >= cHi ? 'push' : v <= cLo ? 'gather' : v <= cLo + 3 ? 'wrap' : 'steady';
        type PhaseKey = 'peak' | 'push' | 'steady' | 'gather' | 'wrap';
        const cPhases = cScores.map(cPhaseOf) as PhaseKey[];
        const cCfg: Record<PhaseKey, {gr?: [string, string]; so?: string; fg: string; label: string}> = {
            peak: {gr: ['#4f46e5', '#6366f1'], fg: 'rgba(255,255,255,0.92)', label: '🔥 发力窗口'},
            push: {gr: ['#818cf8', '#a5b4fc'], fg: 'rgba(255,255,255,0.88)', label: '推进期'},
            steady: {so: '#ddd6fe', fg: '#5b21b6', label: '平稳期'},
            gather: {so: '#ede9fe', fg: '#7c3aed', label: '蓄力期'},
            wrap: {so: '#c7d2fe', fg: '#3730a3', label: '收束期'}
        };
        const cSegs: {phase: PhaseKey; start: number; end: number}[] = [];
        let cCur = {phase: cPhases[0], start: 0, end: 0};
        for (let i = 1; i < 12; i++) {
            if (cPhases[i] === cCur.phase) {
                cCur.end = i;
            } else {
                cSegs.push(cCur);
                cCur = {phase: cPhases[i], start: i, end: i};
            }
        }
        cSegs.push(cCur);

        // Canvas drawing helpers
        const LW = 390,
            DPR = 3;
        const F = (size: number, w: number, style?: string) =>
            `${style ? style + ' ' : ''}${w} ${size}px -apple-system,'PingFang SC','Helvetica Neue',sans-serif`;
        cv.width = LW * DPR;
        cv.height = 100 * DPR;
        cv.style.width = '';
        cv.style.height = '';
        const ctx = cv.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.scale(DPR, DPR);

        function rrRect(
            x: number,
            y: number,
            w: number,
            h: number,
            r: number | {tl?: number; tr?: number; br?: number; bl?: number}
        ) {
            const _r = typeof r === 'object' ? r : {tl: r, tr: r, br: r, bl: r};
            const {tl = 0, tr = 0, br = 0, bl = 0} = _r;
            ctx!.beginPath();
            ctx!.moveTo(x + tl, y);
            ctx!.lineTo(x + w - tr, y);
            ctx!.arcTo(x + w, y, x + w, y + tr, tr);
            ctx!.lineTo(x + w, y + h - br);
            ctx!.arcTo(x + w, y + h, x + w - br, y + h, br);
            ctx!.lineTo(x + bl, y + h);
            ctx!.arcTo(x, y + h, x, y + h - bl, bl);
            ctx!.lineTo(x, y + tl);
            ctx!.arcTo(x, y, x + tl, y, tl);
            ctx!.closePath();
        }

        function wrapLines(text: string, maxW: number, maxL: number): string[] {
            const lines: string[] = [];
            let line = '';
            for (const c of text) {
                if (ctx!.measureText(line + c).width > maxW && line) {
                    lines.push(line);
                    if (lines.length >= maxL) {
                        lines[lines.length - 1] += '…';
                        return lines;
                    }
                    line = c;
                } else {
                    line += c;
                }
            }
            if (line) {
                lines.push(line);
            }
            return lines;
        }

        if (shareKindRef.current === 'life') {
            const LIFE_H = 636;
            cv.height = LIFE_H * DPR;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(DPR, DPR);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, LW, LIFE_H);

            ctx.fillStyle = '#a2a6b0';
            ctx.font = F(8, 600);
            ctx.letterSpacing = '1.4px';
            ctx.fillText('LIFE DATA', 22, 22);
            ctx.textAlign = 'center';
            ctx.fillText('OVERVIEW', LW / 2, 22);
            ctx.textAlign = 'right';
            ctx.fillText('1—100', LW - 22, 22);
            ctx.textAlign = 'left';
            ctx.letterSpacing = '0px';
            ctx.fillStyle = '#20263a';
            ctx.font = F(24, 800);
            ctx.fillText('人生大盘', 22, 60);
            ctx.fillStyle = '#8b93a5';
            ctx.font = F(10, 500);
            ctx.textAlign = 'right';
            ctx.fillText(`${reading.name || '未命名'} · 趋势 / 四柱 / 五行`, LW - 22, 60);
            ctx.textAlign = 'left';

            // Lifetime trend chart
            const series = reading.charts.line.filter(item => item.age <= 100);
            const chartX = 42, chartY = 104, chartW2 = LW - 66, chartH2 = 230;
            ctx.fillStyle = '#f8f9fc';
            rrRect(16, 82, LW - 32, 276, 16);
            ctx.fill();
            ctx.fillStyle = '#30384d';
            ctx.font = F(14, 700);
            ctx.fillText('01  人生趋势', 28, 107);
            const minScore = Math.min(...series.map(item => item.score)) - 3;
            const maxScore = Math.max(...series.map(item => item.score)) + 3;
            const scoreRange = maxScore - minScore || 1;
            const px = (age: number) => chartX + ((age - 1) / 99) * chartW2;
            const py = (score: number) => chartY + 25 + chartH2 - 44 - ((score - minScore) / scoreRange) * (chartH2 - 58);
            ctx.strokeStyle = 'rgba(72,86,130,.08)';
            ctx.lineWidth = 1;
            [0, .5, 1].forEach(t => {
                const y = chartY + 28 + t * (chartH2 - 62);
                ctx.beginPath(); ctx.moveTo(chartX, y); ctx.lineTo(chartX + chartW2, y); ctx.stroke();
                ctx.fillStyle = '#98a0b2';
                ctx.font = F(8, 500);
                ctx.textAlign = 'right';
                ctx.fillText(String(Math.round(maxScore - scoreRange * t)), chartX - 7, y + 3);
                ctx.textAlign = 'left';
            });
            const fill = ctx.createLinearGradient(0, chartY, 0, chartY + chartH2);
            fill.addColorStop(0, 'rgba(89,100,232,.22)');
            fill.addColorStop(1, 'rgba(89,100,232,0)');
            ctx.beginPath();
            series.forEach((item, index) => index === 0 ? ctx.moveTo(px(item.age), py(item.score)) : ctx.lineTo(px(item.age), py(item.score)));
            ctx.lineTo(px(100), chartY + chartH2 - 20); ctx.lineTo(px(1), chartY + chartH2 - 20); ctx.closePath();
            ctx.fillStyle = fill; ctx.fill();
            ctx.beginPath();
            series.forEach((item, index) => index === 0 ? ctx.moveTo(px(item.age), py(item.score)) : ctx.lineTo(px(item.age), py(item.score)));
            ctx.strokeStyle = '#5964e8'; ctx.lineWidth = 2; ctx.stroke();
            const current = series.find(item => item.age === reading.meta.curA);
            if (current) {
                ctx.beginPath(); ctx.arc(px(current.age), py(current.score), 4, 0, Math.PI * 2);
                ctx.fillStyle = '#5964e8'; ctx.fill();
                ctx.fillStyle = '#5964e8'; ctx.font = F(9, 700); ctx.textAlign = 'center';
                ctx.fillText(`${current.age}岁`, px(current.age), py(current.score) - 9); ctx.textAlign = 'left';
            }
            ctx.fillStyle = '#a0a7b5'; ctx.font = F(8, 400); ctx.textAlign = 'center';
            [1, 20, 40, 60, 80, 100].forEach(age => ctx.fillText(`${age}岁`, px(age), chartY + chartH2 - 5));
            ctx.textAlign = 'left';

            // Four pillars
            ctx.fillStyle = '#30384d'; ctx.font = F(14, 700); ctx.fillText('02  四柱数据', 22, 391);
            const pillars = [reading.pillars.year, reading.pillars.month, reading.pillars.day, reading.pillars.hour];
            const pillarLabels = ['年柱', '月柱', '日柱', '时柱'];
            pillars.forEach((pillar, index) => {
                const x = 22 + index * 88;
                ctx.fillStyle = '#f8f9fc'; rrRect(x, 406, 78, 72, 12); ctx.fill();
                ctx.fillStyle = '#969dae'; ctx.font = F(9, 500); ctx.textAlign = 'center'; ctx.fillText(pillarLabels[index], x + 39, 429);
                ctx.fillStyle = '#40485c'; ctx.font = F(18, 750); ctx.fillText(`${pillar.stem}${pillar.branch}`, x + 39, 459);
            });
            ctx.textAlign = 'left';

            // Five-element distribution
            ctx.fillStyle = '#30384d'; ctx.font = F(14, 700); ctx.fillText('03  五行分布', 22, 512);
            const maxElement = Math.max(...EL.map(el => reading.profile[el] || 0), 1);
            EL.forEach((el, index) => {
                const y = 534 + index * 18;
                ctx.fillStyle = '#747c8f'; ctx.font = F(10, 600); ctx.fillText(el, 22, y + 9);
                ctx.fillStyle = '#e7ebf1'; rrRect(42, y, 280, 9, 5); ctx.fill();
                ctx.fillStyle = EC[el]; rrRect(42, y, Math.max(5, ((reading.profile[el] || 0) / maxElement) * 280), 9, 5); ctx.fill();
                ctx.fillStyle = '#7f8798'; ctx.font = F(8, 500); ctx.textAlign = 'right'; ctx.fillText((reading.profile[el] || 0).toFixed(1), 360, y + 8);
                ctx.textAlign = 'left';
            });
            cv.style.width = 'auto';
            cv.style.height = 'auto';
            return;
        }

        // Pre-calculate heights
        const M = 16,
            CW = LW - M * 2,
            G = 8;
        const HH = 82;
        const RROW = 34,
            RGAP = 4,
            RDIMH = DIMS.length * RROW + (DIMS.length - 1) * RGAP;
        const RD = 116,
            RCONTH = Math.max(RD, RDIMH);
        const RCARD = 16 + 18 + 4 + 11 + 10 + RCONTH + 14;
        const ILH = 22,
            IMAXW = CW - 28;
        ctx.font = F(13, 400);
        const iLines: string[] = [];
        for (const p of insParas) {
            iLines.push(...wrapLines(p, IMAXW, 10));
        }
        const ICARD = 0;
        const BH = 24,
            CCARD = 14 + 14 + 6 + BH + 11 + 10;
        const CS = Math.floor((CW - 28 - 11 * 3) / 12),
            CGAP = 3;
        const LRH = 44,
            LCARD = 14 + 14 + 6 + LRH + 10;
        const WCARD = 142;
        const OVERVIEW_CARD = RCARD;
        const MONTHLY_CARD = CCARD + LCARD + WCARD;
        const LH = HH + OVERVIEW_CARD + G + MONTHLY_CARD + 38;
        cv.height = LH * DPR;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(DPR, DPR);
        let Y = 0;

        function drawCard(x: number, y: number, w: number, h: number, _r?: number) {
            rrRect(x, y, w, h, _r || 16);
            ctx!.fillStyle = '#f8f9fc';
            ctx!.fill();
            ctx!.strokeStyle = 'rgba(84,96,142,0.10)';
            ctx!.lineWidth = 1;
            ctx!.stroke();
        }

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, LW, LH);

        // Editorial report header
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, LW, HH);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#a2a6b0';
        ctx.font = F(8, 600);
        ctx.letterSpacing = '1.4px';
        ctx.fillText('LIFE DATA', 22, 22);
        ctx.textAlign = 'center';
        ctx.fillText(String(pt.year), LW / 2, 22);
        ctx.textAlign = 'right';
        ctx.fillText('ANNUAL', LW - 22, 22);
        ctx.textAlign = 'left';
        ctx.letterSpacing = '0px';
        ctx.fillStyle = '#20263a';
        ctx.font = F(24, 800);
        ctx.fillText('年度数据摘要', 22, 60);
        ctx.fillStyle = '#8790a5';
        ctx.font = F(10, 500);
        ctx.textAlign = 'right';
        ctx.fillText(`${reading.name || '未命名'} · ${a}岁 · ${grade}`, LW - 22, 60);
        ctx.textAlign = 'left';
        Y = HH;

        // Overview card: score details + annual reading
        drawCard(M, Y, CW, OVERVIEW_CARD);
        ctx.fillStyle = '#1c1c1e';
        ctx.font = F(16, 700);
        ctx.fillText(`01  ${pt.year}核心数据`, M + 16, Y + 16 + 14);
        ctx.fillStyle = '#8e8e93';
        ctx.font = F(12, 400);
        ctx.fillText('总分与四项关键指标', M + 16, Y + 16 + 14 + 4 + 11);
        ctx.textAlign = 'left';
        const RCTOP = Y + 16 + 18 + 4 + 11 + 10;
        const RCX = M + 16 + RD / 2,
            RCY = RCTOP + RCONTH / 2;
        const rScale = RD / 150;
        const rCenterR = 28 * rScale,
            rOuterR = RD / 2 - 6 * rScale,
            rGap = 3 * rScale;
        const rBandBudget = rOuterR - rCenterR - rGap * 3;
        const rRatios = [1.3, 1.15, 1, 0.9];
        const rRatioSum = rRatios.reduce((acc, v) => acc + v, 0);
        const rWidths = rRatios.map(rt => Math.max(4, (rBandBudget * rt) / rRatioSum));
        const rRadii: number[] = [];
        let rCursor = rOuterR;
        for (let i = 0; i < 4; i++) {
            rRadii.push(rCursor - rWidths[i] / 2);
            rCursor -= rWidths[i] + (i < 3 ? rGap : 0);
        }
        const SA = -Math.PI / 2;
        DIMS.forEach((d, i) => {
            const ri = rRadii[i],
                bw = rWidths[i],
                sv = DSR[d.key] as number;
            ctx.beginPath();
            ctx.arc(RCX, RCY, ri, 0, Math.PI * 2);
            ctx.strokeStyle = d.track;
            ctx.lineWidth = bw;
            ctx.lineCap = 'round';
            ctx.stroke();
            const endA = SA + (sv / 100) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(RCX, RCY, ri, SA, endA);
            ctx.strokeStyle = d.color[0];
            ctx.lineWidth = bw;
            ctx.lineCap = 'round';
            ctx.stroke();
        });
        const rFs1 = Math.round(28 * rScale),
            rFs2 = Math.round(10 * rScale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = F(rFs1, 800);
        ctx.fillStyle = '#1c1c1e';
        ctx.fillText(String(pt.score), RCX, RCY - 2 * rScale);
        ctx.font = F(rFs2, 500);
        ctx.fillStyle = '#8e8e93';
        ctx.fillText('总分', RCX, RCY + 16 * rScale);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        const DX = M + 16 + RD + 14,
            DW = CW - 16 - RD - 14 - 16;
        const DLTOP = RCTOP + (RCONTH - RDIMH) / 2;
        DIMS.forEach((d, i) => {
            const ry = DLTOP + i * (RROW + RGAP),
                sv = DSR[d.key] as number;
            // dot
            ctx.beginPath();
            ctx.arc(DX + 5, ry + 8, 4, 0, Math.PI * 2);
            ctx.fillStyle = d.color[0];
            ctx.fill();
            // label
            ctx.fillStyle = '#3c3c43';
            ctx.font = F(12, 600);
            ctx.fillText(d.label, DX + 16, ry + 12);
            // score — right-aligned in color
            ctx.textAlign = 'right';
            ctx.fillStyle = d.color[0];
            ctx.font = F(18, 800);
            ctx.fillText(String(sv), DX + DW, ry + 16);
            ctx.textAlign = 'left';
        });
        Y += RCARD + G;

        // Monthly card: career + love + wealth
        drawCard(M, Y, CW, MONTHLY_CARD);
        ctx.fillStyle = '#0f172a';
        ctx.font = F(13, 700);
        ctx.fillText(`02  事业 · 12个月节奏`, M + 16, Y + 16 + 12);
        ctx.fillStyle = DIMS[0].color[0];
        ctx.font = F(18, 800);
        ctx.textAlign = 'right';
        ctx.fillText(String(DSR[DIMS[0].key] as number), M + CW - 16, Y + 16 + 13);
        ctx.textAlign = 'left';
        const BX = M + 16,
            BY = Y + 16 + 14 + 6,
            BW = CW - 32,
            BC = BW / 12;
        cSegs.forEach(sg => {
            const c = cCfg[sg.phase];
            const sx = BX + sg.start * BC,
                sw = (sg.end - sg.start + 1) * BC;
            const isFirst = sg.start === 0,
                isLast = sg.end === 11;
            const rad = {tl: isFirst ? 6 : 0, bl: isFirst ? 6 : 0, tr: isLast ? 6 : 0, br: isLast ? 6 : 0};
            if (c.gr) {
                const gg = ctx.createLinearGradient(sx, BY, sx + sw, BY);
                gg.addColorStop(0, c.gr[0]);
                gg.addColorStop(1, c.gr[1]);
                ctx.fillStyle = gg;
            } else {
                ctx.fillStyle = c.so!;
            }
            rrRect(sx, BY, sw, BH, rad);
            ctx.fill();
            const span = sg.end - sg.start + 1;
            if (span >= 2) {
                ctx.fillStyle = c.fg;
                ctx.font = F(9, 600);
                ctx.textAlign = 'center';
                ctx.fillText(c.label.replace(/^.*\s/, ''), sx + sw / 2, BY + BH / 2 + 3);
                ctx.textAlign = 'left';
            }
        });
        ctx.fillStyle = '#8e8e93';
        ctx.font = F(9, 400);
        ctx.textAlign = 'center';
        for (let mi = 0; mi < 12; mi++) {
            ctx.fillText(`${mi + 1}`, BX + (mi + 0.5) * BC, BY + BH + 11);
        }
        ctx.textAlign = 'left';
        Y += CCARD;

        // Love heatmap section
        ctx.strokeStyle = 'rgba(102,80,157,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(M + 16, Y);
        ctx.lineTo(M + CW - 16, Y);
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = F(13, 700);
        ctx.fillText(`感情 · 12个月热力`, M + 16, Y + 16 + 12);
        ctx.fillStyle = DIMS[2].color[0];
        ctx.font = F(18, 800);
        ctx.textAlign = 'right';
        ctx.fillText(String(DSR[DIMS[2].key] as number), M + CW - 16, Y + 16 + 13);
        ctx.textAlign = 'left';
        const LCELL_X = M + 16,
            LCELL_Y = Y + 16 + 14 + 6;
        const lScores = mL.map(d => d.score);
        const lLo = Math.min(...lScores),
            lHi = Math.max(...lScores),
            lRng = lHi - lLo || 1;
        mL.forEach((ml, i) => {
            const lcx = LCELL_X + i * (CS + CGAP),
                lcy = LCELL_Y;
            const t = (ml.score - lLo) / lRng;
            const alpha = (0.1 + t * 0.55).toFixed(2);
            rrRect(lcx, lcy, CS, LRH, 6);
            ctx.fillStyle = `rgba(242,53,141,${alpha})`;
            ctx.fill();
            const fg = t > 0.6 ? '#7b0040' : '#c2185b';
            ctx.fillStyle = fg;
            ctx.font = F(8, 500);
            ctx.textAlign = 'center';
            ctx.fillText(`${ml.month}`, lcx + CS / 2, lcy + 18);
            ctx.font = F(11, 700);
            ctx.fillText(String(ml.score), lcx + CS / 2, lcy + 39);
            ctx.textAlign = 'left';
        });
        Y += LCARD;

        // Wealth K-line section
        ctx.strokeStyle = 'rgba(102,80,157,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(M + 16, Y);
        ctx.lineTo(M + CW - 16, Y);
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = F(13, 700);
        ctx.fillText(`财富 · 12个月K线`, M + 16, Y + 16 + 12);
        ctx.fillStyle = DIMS[1].color[0];
        ctx.font = F(18, 800);
        ctx.textAlign = 'right';
        ctx.fillText(String(DSR[DIMS[1].key] as number), M + CW - 16, Y + 16 + 13);
        ctx.textAlign = 'left';
        const WPL = 28,
            WPR = 8,
            WPT = 10,
            WPB = 22;
        const WX = M + 16 + WPL,
            WYS = Y + 16 + 14 + 6 + WPT;
        const WW = CW - 32 - WPL - WPR,
            WH = WCARD - 16 - 14 - 6 - WPT - WPB - 16;
        const wmn = Math.min(...mW.map(m => m.score)) - 3;
        const wmx = Math.max(...mW.map(m => m.score)) + 3;
        const wrng = wmx - wmn || 1;
        const wyScore = (sv: number) => WYS + WH - ((sv - wmn) / wrng) * WH;
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5;
        [0, 0.5, 1].forEach(t => {
            const gy = WYS + WH * (1 - t);
            ctx.beginPath();
            ctx.moveTo(WX, gy);
            ctx.lineTo(WX + WW, gy);
            ctx.stroke();
            ctx.fillStyle = '#8e8e93';
            ctx.font = F(7, 400);
            ctx.textAlign = 'right';
            ctx.fillText(String(Math.round(wmn + wrng * t)), WX - 3, gy + 2.5);
            ctx.textAlign = 'left';
        });
        const KW = WW / 12;
        mW.forEach((mw, i) => {
            const prev = mW[i > 0 ? i - 1 : 0],
                rise = mw.score >= prev.score;
            const col = rise ? '#ef4444' : '#22c55e',
                kx = WX + i * KW + KW / 2;
            const oY = wyScore(prev.score),
                cY = wyScore(mw.score);
            const diff = Math.abs(mw.score - prev.score);
            const hY = wyScore(Math.max(mw.score, prev.score) + diff * 0.25);
            const lY = wyScore(Math.min(mw.score, prev.score) - diff * 0.25);
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(kx, hY);
            ctx.lineTo(kx, lY);
            ctx.stroke();
            const bY = Math.min(oY, cY),
                bH = Math.max(Math.abs(oY - cY), 2);
            rrRect(kx - KW * 0.32, bY, KW * 0.64, bH, 1);
            ctx.fillStyle = col;
            ctx.fill();
            // every month label
            ctx.fillStyle = '#8e8e93';
            ctx.font = F(7, 400);
            ctx.textAlign = 'center';
            ctx.fillText(`${mw.month}月`, kx, WYS + WH + 14);
            ctx.textAlign = 'left';
        });
        const bwM = mW.reduce((acc, b) => (acc.score > b.score ? acc : b));
        const wwM = mW.reduce((acc, b) => (acc.score < b.score ? acc : b));
        ctx.font = F(7, 600);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(String(bwM.score), WX + (bwM.month - 0.5) * KW, wyScore(bwM.score) - 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillText(String(wwM.score), WX + (wwM.month - 0.5) * KW, wyScore(wwM.score) + 10);
        ctx.textAlign = 'left';
        Y += WCARD;

        // Quiet signature footer
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, Y, LW, 38);
        ctx.fillStyle = '#6f6679';
        ctx.font = F(10, 500);
        ctx.textAlign = 'center';
        ctx.fillText('看见节奏，也看见选择', LW / 2, Y + 17);
        ctx.fillStyle = '#81669c';
        ctx.font = F(8, 600);
        ctx.letterSpacing = '1.8px';
        ctx.fillText('LIFE · DATA  /  人生数据看板', LW / 2, Y + 33);
        ctx.letterSpacing = '0px';
        ctx.textAlign = 'left';
        cv.style.width = 'auto';
        cv.style.height = 'auto';
    }, [reading, selAge]);

    /* ── Open share overlay ── */
    const openShare = useCallback((kind: 'life' | 'year' = 'year') => {
        if (!reading) {
            return;
        }
        shareKindRef.current = kind;
        log('click', 'share');
        setShowShareOverlay(true);
        requestAnimationFrame(() => drawShareCanvas());
    }, [reading, drawShareCanvas, log]);

    /* ── Save share image ── */
    const saveShareAsImage = useCallback(async () => {
        if (!shareCanvasRef.current) {
            return;
        }
        log('click', 'new_agent', {action_type: 'save'});
        setShareSaving(true);
        try {
            const dataUrl = shareCanvasRef.current.toDataURL('image/png');
            await NewAppBridge.image.save(dataUrl);
        } catch (_e) {
            NewAppBridge.toast.error('保存失败，请截图保存');
        }
        setShareSaving(false);
    }, []);

    /* ── Scroll to age on chart ── */
    const scrollToAge = useCallback(
        (age: number) => {
            if (!reading || !scrollRef.current) {
                return;
            }
            const series = reading.charts.line;
            const dw = chartW(series.length);
            const step = (dw - PAD.left - PAD.right) / Math.max(1, series.length - 1);
            const idx = Math.max(
                0,
                series.findIndex(i => i.age === age)
            );
            const tx = PAD.left + step * idx;
            const vw = scrollRef.current.clientWidth;
            scrollRef.current.scrollLeft = Math.max(0, Math.min(dw - vw, tx - vw * 0.45));
        },
        [reading, chartW]
    );

    /* ── Effects: draw charts when state changes ── */
    useEffect(() => {
        if (showResult && reading && dashboardTab === 'life') {
            drawChart();
            scrollToAge(selAge);
        }
    }, [showResult, reading, selAge, chartMode, pointGap, dashboardTab, drawChart, scrollToAge]);

    useEffect(() => {
        if (!showResult || !reading || dashboardTab !== 'year') {
            return;
        }
        const pt = reading.charts.line.find(i => i.age === selAge);
        if (!pt) {
            return;
        }
        const scores = buildDimScores(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        drawRingChart(scores);
    }, [showResult, reading, selAge, dashboardTab, drawRingChart]);

    useEffect(() => {
        if (!showResult || !reading || dashboardTab !== 'life' || activeSection !== 'personality') {
            return;
        }
        const timer = setTimeout(drawRadarChart, 50);
        return () => clearTimeout(timer);
    }, [showResult, reading, activeSection, selAge, dashboardTab, drawRadarChart]);

    useEffect(() => {
        if (!showResult || !reading || activeSection !== 'wealth') {
            return;
        }
        const pt = reading.charts.line.find(i => i.age === selAge);
        if (!pt) {
            return;
        }
        const mw = buildMonthWealth(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const timer = setTimeout(() => drawWealthChart(mw), 50);
        return () => clearTimeout(timer);
    }, [showResult, reading, activeSection, selAge, drawWealthChart]);

    /* ── Build ring right panel HTML ── */
    const ringRightHtml = (() => {
        if (!reading) {
            return '';
        }
        const pt = reading.charts.line.find(i => i.age === selAge);
        if (!pt) {
            return '';
        }
        const scores = buildDimScores(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        return DIMS.map(dim => {
            const s = ds(scores)[dim.key] as number;
            return `<div class="${styles.dimRow}"><div class="${styles.dimInfo}"><div class="${styles.dimTop}"><span class="${styles.dimLabelGroup}"><span class="${styles.dimDot}" style="background:${dim.color[0]}"></span><span class="${styles.dimLabel}">${dim.label}</span></span><span class="${styles.dimScore}" style="color:${dim.color[0]}">${s}</span></div><div class="${styles.dimQuip}">${dimQuip(dim.key, s, selAge)}</div></div></div>`;
        }).join('');
    })();

    /* ── Build year insight HTML (matches original yearInsight() exactly) ── */
    const yearInsightHtml = (() => {
        if (!reading) {
            return '';
        }
        const pt = reading.charts.line.find(i => i.age === selAge);
        if (!pt) {
            return '';
        }
        const scores = buildDimScores(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        const s = pt.score,
            a = pt.age,
            yr = pt.year;
        const dm = reading.dm;
        const hi = DIMS.reduce((best, d) => (ds(scores)[d.key] >= ds(scores)[best.key] ? d : best));
        const lo = DIMS.reduce((best, d) => (ds(scores)[d.key] <= ds(scores)[best.key] ? d : best));
        let vibe = '',
            advice = '';
        if (a <= 3) {
            if (s >= 85) {
                vibe = `${yr}年，你在${a}岁时整体状态较好，成长与适应的节奏比较顺。`;
                advice = `<b>核心任务：健康成长。</b>这个年纪最重要的事业就是长身体，最大的财富就是全家人的爱。${hi.label}维度最亮（${ds(scores)[hi.key]}分），说明命格底子不错，慢慢来不着急。`;
            } else if (s >= 70) {
                vibe = `${yr}年，你在${a}岁时状态平稳，正处在感知和认识世界的阶段。`;
                advice = `<b>核心任务：探索世界。</b>吃饭、睡觉、玩耍就是全部日程。${lo.label}稍弱（${ds(scores)[lo.key]}分），但在这个年纪完全不用操心，长大自然就好了。`;
            } else {
                vibe = `${yr}年运势偏低调，不过别担心——人家才${a}岁，人生还没正式开始呢。`;
                advice = `<b>核心任务：平安快乐。</b>这个阶段规律饮食、稳定作息和安全感最重要。${dm.fav}属性的环境与你更合拍，比如${dm.fav === '水' ? '听音乐、亲近水' : dm.fav === '木' ? '接触自然和绿植' : dm.fav === '火' ? '多晒太阳、接触暖色' : dm.fav === '金' ? '保持环境整洁有序' : '饮食均衡、多接触自然'}。`;
            }
        } else if (a <= 12) {
            if (s >= 85) {
                vibe = `${yr}年，你在${a}岁时学习和适应状态较好，理解新事物会更顺手。`;
                advice = `<b>核心策略：兴趣驱动。</b>这是打基础的黄金期，不用卷成绩但值得多尝试。${hi.label}维度突出（${ds(scores)[hi.key]}分），顺着天赋走不费劲。适当培养${dm.fav}属性相关的兴趣爱好，事半功倍。`;
            } else if (s >= 70) {
                vibe = `${yr}年，你在${a}岁时整体平稳，按自己的节奏积累即可。`;
                advice = `<b>核心策略：快乐学习。</b>成绩重要但不是全部，身心状态更值得关注。${lo.label}偏弱（${ds(scores)[lo.key]}分），${lo.key === 'health' ? '注意用眼和运动' : lo.key === 'love' ? '可以多参加集体活动，练习表达和相处' : '不必着急，按节奏积累'}。`;
            } else {
                vibe = `${yr}年，你在${a}岁时状态有所波动，这是成长过程中的正常起伏。`;
                advice = `<b>核心策略：稳住节奏。</b>状态偏低时更需要安全感和积极反馈。${hi.label}还不错（${ds(scores)[hi.key]}分），可以从这一项获得信心，同时给自己留出运动和放松的时间。`;
            }
        } else if (a <= 18) {
            if (s >= 85) {
                vibe = `${yr}年，${a}岁的运势直接起飞，考试运、人缘运都在线，是全力冲刺的好年份。`;
                advice = `<b>核心策略：集中火力。</b>${hi.label}维度拉满（${ds(scores)[hi.key]}分），是你的王牌。学业上适合冲击目标院校，但也别忽略身体——熬夜有上限。${dm.fav}属性的月份安排重要考试和决定，赢面更大。`;
            } else if (s >= 70) {
                vibe = `${yr}年运势中规中矩，${a}岁正是打地基的年纪，稳扎稳打就好。`;
                advice = `<b>核心策略：补短板。</b>${lo.label}偏弱（${ds(scores)[lo.key]}分），${lo.key === 'career' ? '偏科的话趁早补，高考不等人' : lo.key === 'health' ? '别拿身体换成绩，注意颈椎和眼睛' : lo.key === 'love' ? '青春期社交困惑很正常，过来人都懂' : '合理规划零花钱也是一种能力'}。`;
            } else {
                vibe = `${yr}年运势承压，但${a}岁遇到低谷不是坏事——早经历早成长。`;
                advice = `<b>核心策略：心态第一。</b>成绩有波动很正常，别因一次考砸就否定自己。${hi.label}还有${ds(scores)[hi.key]}分的底气，守住优势科目。学会跟压力相处，这个本事比任何知识点都值钱。`;
            }
        } else if (a <= 30) {
            if (s >= 90) {
                vibe = `${yr}年运势直接拉满，${a}岁正是冲劲最足的年纪，老天还给你开了加速器。`;
                advice = `<b>核心策略：大胆出击。</b>事业上争曝光、争资源，该主动的别矜持。感情上适合推进关键节点。${hi.label}是最强维度（${ds(scores)[hi.key]}分），重点押注不亏。年轻就是资本，试错成本最低的时候，别怂。`;
            } else if (s >= 80) {
                vibe = `${yr}年运势中上，${a}岁节奏稳健。不算躺赢但明显有牌可打，关键是别浪。`;
                advice = `<b>核心策略：稳中求进。</b>${hi.label}最亮眼（${ds(scores)[hi.key]}分），是发力点；${lo.label}偏弱（${ds(scores)[lo.key]}分），别在这个方向赌太大。${dm.st ? '身强之人控制住冲劲，把力气花在刀刃上' : '身弱之人多借团队和平台的力，别硬扛'}。`;
            } else if (s >= 70) {
                vibe = `${yr}年属于蓄力期，${a}岁看起来平淡，但今年种的因决定后面好几年的果。`;
                advice = `<b>核心策略：深耕内功。</b>适合学新技能、攒人脉、修复关系。${hi.label}相对能打（${ds(scores)[hi.key]}分），维持住就好。${dm.fav}属性的月份多安排重要事项，${dm.bad}属性的月份低调为主。`;
            } else {
                vibe = `${yr}年运势偏低，但${a}岁的低谷只是蹲下来跳得更高。`;
                advice = `<b>核心策略：守住基本盘。</b>别冲动裸辞、冲动分手、冲动投资——三不原则。${hi.label}还有${ds(scores)[hi.key]}分，是为数不多的支撑点。${dm.st ? '收着点锋芒，韧性比冲劲更值钱' : '主动寻求贵人支持，开口求助不丢人'}。`;
            }
        } else if (a <= 45) {
            if (s >= 90) {
                vibe = `${yr}年运势大吉，${a}岁经验和运气双重加持，属于老天爷追着喂饭。`;
                advice = `<b>核心策略：乘势扩张。</b>事业上可以争取更大的盘子，财务上适当扩大投资半径。${hi.label}拉满（${ds(scores)[hi.key]}分），是绝对的发力方向。这个年纪的高光期含金量极高，别浪费。`;
            } else if (s >= 80) {
                vibe = `${yr}年运势稳健，${a}岁正是黄金发力期，有实力有机会。`;
                advice = `<b>核心策略：效率优先。</b>时间是最贵的资源，少做无效社交。${hi.label}（${ds(scores)[hi.key]}分）值得加码；${lo.label}（${ds(scores)[lo.key]}分）做好风控就行。${dm.st ? '中年身强，小心刚过易折' : '中年身弱，学会借力打力'}。`;
            } else if (s >= 70) {
                vibe = `${yr}年运势平稳，${a}岁的平稳不是无聊，是在为下一次爆发攒弹药。`;
                advice = `<b>核心策略：守正出奇。</b>基本盘不动，小范围试新方向。${lo.label}是短板（${ds(scores)[lo.key]}分），${lo.key === 'health' ? '健康投资回报率最高，别省' : '做好防守别踩坑就行'}。中年人最怕的不是没机会，是选错赛道。`;
            } else {
                vibe = `${yr}年运势承压，${a}岁的低谷期确实不太舒服，但你比年轻时有更多底牌。`;
                advice = `<b>核心策略：战略收缩。</b>砍掉不赚钱的投入，守住核心资产。${hi.label}还有${ds(scores)[hi.key]}分的空间，是穿越周期的锚。家庭是最稳的后盾，别忽视。`;
            }
        } else if (a <= 60) {
            if (s >= 90) {
                vibe = `${yr}年运势大旺，${a}岁依然能打，多年积累在这一年集中兑现。`;
                advice = `<b>核心策略：收获季。</b>之前种下的因，现在结果了。${hi.label}（${ds(scores)[hi.key]}分）是主收益方向。适合做长线决策、传承规划。身体是一切的本钱，高光期也别忘记体检。`;
            } else if (s >= 80) {
                vibe = `${yr}年运势不错，${a}岁经验丰富，知道什么该做什么该放下。`;
                advice = `<b>核心策略：从容布局。</b>不用再证明什么，做自己擅长的就好。${lo.label}偏弱（${ds(scores)[lo.key]}分），${lo.key === 'health' ? '健康是头等大事，定期复查' : '接受它，把精力给高回报的事'}。`;
            } else if (s >= 70) {
                vibe = `${yr}年运势平和，${a}岁的平稳是一种福气，安安稳稳就很好。`;
                advice = `<b>核心策略：知足常乐。</b>别跟年轻人比冲劲，你有他们没有的阅历和定力。${hi.label}（${ds(scores)[hi.key]}分）是你的压舱石。适合整理人际关系，留下真正重要的人。`;
            } else {
                vibe = `${yr}年运势偏低，${a}岁的身体和心态比运势数字重要得多。`;
                advice = `<b>核心策略：减法生活。</b>减少不必要的操心和消耗，把能量留给自己。${hi.label}（${ds(scores)[hi.key]}分）守住就好。多出门走走、晒晒太阳，好心情比好运势管用。`;
            }
        } else {
            if (s >= 85) {
                vibe = `${yr}年，${a}岁运势依然红火，退休生活过得比上班还精彩，令人羡慕。`;
                advice = `<b>核心关注：享受生活。</b>${hi.label}维度亮眼（${ds(scores)[hi.key]}分），${hi.key === 'career' ? '发挥余热，当顾问或带徒弟都很合适' : hi.key === 'wealth' ? '财务无忧是最大的底气' : hi.key === 'love' ? '有人陪伴是最大的幸福' : '身体硬朗就是最大的资本'}。适合旅行、学新东西、培养爱好，人生下半场同样精彩。`;
            } else if (s >= 70) {
                vibe = `${yr}年运势平和，${a}岁不求大富大贵，身边有人、心里有光就够了。`;
                advice = `<b>核心关注：身心平衡。</b>保持规律作息和适度运动。${lo.label}稍弱（${ds(scores)[lo.key]}分），${lo.key === 'health' ? '这个年纪健康是第一优先级，一定要重视体检和复查' : '不必在意，把精力给让你开心的事'}。生活节奏慢下来，反而能看见更多风景。`;
            } else {
                vibe = `${yr}年运势偏低调，${a}岁最重要的不是运势高低，是每一天都舒心。`;
                advice = `<b>核心关注：顺其自然。</b>不和自己较劲，不和身体较劲。${hi.label}（${ds(scores)[hi.key]}分）说明生活中还是有亮点的。子女的关心、老友的陪伴、清晨的阳光——这些不在评分里，但比什么都值钱。`;
            }
        }
        const lnSi = (((yr - 4) % 10) + 10) % 10;
        const lnBi = (((yr - 4) % 12) + 12) % 12;
        const lnStem = STEMS[lnSi];
        const lnBranch = BRANCHES[lnBi];
        const lnSE = S_EL[lnSi];
        const lnBE = B_EL[lnBi];
        const favHit = lnSE === dm.fav || lnBE === dm.fav;
        const badHit = lnSE === dm.bad || lnBE === dm.bad;
        const flowText = favHit && badHit
            ? '喜忌同时出现，机会与压力往往相伴，需要把握节奏'
            : favHit
              ? `流年见喜用之${dm.fav}，外部助力相对更明显`
              : badHit
                ? `流年触及忌神${dm.bad}，推进重要事项时更适合留有余地`
                : '流年五行与命局关系较为平和，结果更依赖自身选择和积累';
        const curDY = reading.daYun.pillars.find(d => a >= d.startAge && a <= d.endAge);
        const dyText = curDY
            ? `当前处于${curDY.stem}${curDY.branch}大运（${curDY.startAge}—${curDY.endAge}岁），大运提供长期背景；${yr}年${lnStem}${lnBranch}流年（${lnSE}${lnBE}）则决定这一年的具体起伏。`
            : `${reading.daYun.startAge}岁前尚未正式起运，主要以原局与${yr}年${lnStem}${lnBranch}流年的作用来判断年度节奏。`;
        const stage = a <= 6 ? '启蒙阶段' : a <= 17 ? '学习成长阶段' : a <= 29 ? '探索与定向阶段' : a <= 44 ? '发展与承担阶段' : a <= 59 ? '沉淀与整合阶段' : '从容经营阶段';
        const level = s >= 88 ? '整体能量较强，适合主动把握机会' : s >= 78 ? '整体处于稳中有进的区间' : s >= 68 ? '整体节奏平稳，更适合积累与调整' : '整体承压，宜优先守住基本盘';
        const focusMap: Record<string, string> = {
            career: a < 18 ? '把精力放在学习方法、专注力和阶段目标上' : '把资源集中到最重要的工作目标，减少低回报消耗',
            wealth: a < 18 ? '建立基本的金钱观和规划意识即可' : '重视现金流与风险边界，不因短期波动做激进决定',
            love: a < 18 ? '在同伴互动中练习表达、倾听与边界感' : '重要关系宜多沟通真实需求，少用猜测代替确认',
            health: '规律作息、适度运动和及时休息，是维持全年状态的基础'
        };
        const overview = `${yr}年你处于${stage}，${level}。四项指标中，${hi.label}表现最突出（${ds(scores)[hi.key]}分），是这一年更值得借力的方向；${lo.label}相对偏弱（${ds(scores)[lo.key]}分），需要提前留意，但不代表一定会发生不利结果。`;
        const basis = `<b>命理依据：</b>日主为${dm.stem}${dm.el}，命局${dm.st ? '身强' : '身弱'}，以${dm.fav}为喜用、${dm.bad}为忌。${dyText}${flowText}。`;
        const practical = `<b>现实建议：</b>${focusMap[hi.key]}；同时在${lo.label}方面做好基本防守。八字分析反映的是阶段倾向，不替代现实中的信息、判断与行动。`;
        return `<div class="${styles.yearInsightTitle}">✦ ${yr}年度洞察</div><p>${overview}</p><p>${basis}</p><p>${practical}</p>`;
    })();

    /* ── Ring header info ── */
    const ringHeaderHtml = (() => {
        if (!reading) {
            return '';
        }
        const pt = reading.charts.line.find(i => i.age === selAge);
        if (!pt) {
            return '';
        }
        const scores = buildDimScores(pt, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
        return `<div class="${styles.ringTitle}">${pt.year}年运势详情</div><div class="${styles.ringSubtitle}">总分 ${scores.total} · ${bandLA(pt.score, pt.age)}</div>`;
    })();

    /* ── Build summary / section content ── */
    const sectionHtml = (() => {
        if (!reading) {
            return '';
        }
        const pil = reading.pillars,
            dm = reading.dm,
            es = reading.es,
            prof = reading.profile,
            narr = reading.narr;
        const cp =
            reading.charts.line.find(i => i.age === selAge) || reading.charts.line[reading.charts.line.length - 1];
        const s = cp.score,
            band = bandL(s);
        const dmS = dm.st ? '身强' : '身弱';
        const labels4 = ['年柱', '月柱', '日柱', '时柱'];
        const cols4 = [pil.year, pil.month, pil.day, pil.hour];
        const pillsHtml = cols4
            .map(
                (c, i) =>
                    `<div class="${styles.scPill}"><div class="${styles.scPillLbl}">${labels4[i]}</div><div class="${styles.scPillVal}">${c.stem}${c.branch}</div></div>`
            )
            .join('');
        const favsH = dm.favs.map(e => `<span style="color:${EC[e]}">${e}</span>`).join(' ');
        const badsH = dm.bads.map(e => `<span style="color:${EC[e]}">${e}</span>`).join(' ');
        const infoBlock = `<div class="${styles.scRow}"><div class="${styles.scPills}">${pillsHtml}</div><div class="${styles.scMetaLine}"><span class="${styles.scChip} ${styles.scChipDm}">${dm.stem}${dm.el}</span><span class="${styles.scChip} ${styles.scChipSt}">${dmS}</span><span class="${styles.scChip} ${styles.scChipFav}"><span class="${styles.scChipLbl}">喜</span>${favsH}</span><span class="${styles.scChip} ${styles.scChipBad}"><span class="${styles.scChipLbl}">忌</span>${badsH}</span></div></div>`;
        const elBarsHtml = (() => {
            const mx = Math.max(...Object.values(prof));
            return EL.map(el => {
                const raw = Math.round((prof[el] / mx) * 100),
                    pct = prof[el] > 0 ? Math.max(3, raw) : 0;
                return `<div class="${styles.elBarRow}"><span class="${styles.elBarLabel}" style="color:${EC[el]}">${el}</span><div class="${styles.elBarTrack}"><div class="${styles.elBarFill}" style="width:${pct}%;background:${EC[el]}${pct === 0 ? ';opacity:0.2' : ''}"></div></div><span class="${styles.elBarVal}">${prof[el].toFixed(1)}${prof[el] < 0.1 ? '(缺)' : ''}</span></div>`;
            }).join('');
        })();
        const tl = analyzeTL(reading.charts.line, selAge);
        const daYun = reading.daYun;
        const balD =
            es.bal >= 88
                ? '五行流通较好，格局端正'
                : es.bal >= 76
                  ? '五行略有偏颇，可借大运补调'
                  : '五行偏枯之象，需借运势调和';
        const cpYear = cp.year;
        const missing = EL.filter(e => prof[e] < 0.1);
        const missingMap: Record<string, string> = {
            '木': '创造力与生发之气不足，宜在大运流年借木气补充，多接触绿色、东方、植物',
            '火': '表达力与爆发力偏弱，宜借火运弥补，多接触红色、南方、社交活动',
            '土': '稳定性与落地能力欠缺，宜借土运调和，注意规律作息、接地气',
            '金': '决断力与收束力薄弱，宜借金运增强，适当培养纪律性和边界感',
            '水': '灵活性与变通力不够，宜借水运通关，多接触蓝色、北方、流动性事务'
        };
        const missingTxt = missing.length
            ? `命局<b>缺${missing.join('、')}</b>，${missing.map(e => missingMap[e] || '').join('；')}。`
            : '五行俱全，格局较为完整。';
        const curDY = daYun.pillars.find(d => selAge >= d.startAge && selAge <= d.endAge);
        const dyDesc = curDY
            ? `当前大运<b>${curDY.stem}${curDY.branch}</b>（${curDY.sEl}${curDY.bEl}），${curDY.sEl === dm.fav || curDY.bEl === dm.fav ? '大运见用神，运势得力' : '大运' + (curDY.sEl === dm.bad || curDY.bEl === dm.bad ? '见忌神，需谨慎应对' : '五行平和，稳步过渡')}，管${curDY.startAge}～${curDY.endAge}岁。`
            : `${daYun.startAge}岁起运前，受月柱<b>${pil.month.stem}${pil.month.branch}</b>（${pil.month.sEl}${pil.month.bEl}）影响为主。`;
        const lnSi = (((cpYear - 4) % 10) + 10) % 10,
            lnBi = (((cpYear - 4) % 12) + 12) % 12;
        const lnStem = STEMS[lnSi],
            lnBranch = BRANCHES[lnBi],
            lnSE = S_EL[lnSi],
            lnBE = B_EL[lnBi];
        const lnDesc = `流年<b>${lnStem}${lnBranch}</b>（${lnSE}${lnBE}），${lnSE === dm.fav || lnBE === dm.fav ? '流年见用神，助力明显' : lnSE === dm.bad || lnBE === dm.bad ? '流年见忌神，宜守不宜攻' : '流年五行中性，平稳过渡'}。`;
        const TEN_GOD_MAP: Record<string, string> = {};
        const tgCycle = ['木', '火', '土', '金', '水'];
        const dmi = tgCycle.indexOf(dm.el);
        TEN_GOD_MAP[tgCycle[dmi]] = '比劫';
        TEN_GOD_MAP[tgCycle[(dmi + 1) % 5]] = '食伤';
        TEN_GOD_MAP[tgCycle[(dmi + 2) % 5]] = '财星';
        TEN_GOD_MAP[tgCycle[(dmi + 3) % 5]] = '官杀';
        TEN_GOD_MAP[tgCycle[(dmi + 4) % 5]] = '印星';
        const domGod = TEN_GOD_MAP[es.dom] || '',
            weakGod = TEN_GOD_MAP[es.weak] || '';
        const godDesc: Record<string, string> = {
            '比劫': '同类助力旺，竞争意识强但也易与人争利',
            '食伤': '才华表达旺，创造力强但也易多思多虑',
            '财星': '求财欲望强，行动力足但也易操劳',
            '官杀': '责任感重，规则意识强但也易承压',
            '印星': '学习力强，贵人缘好但也易依赖保护'
        };
        const weakFunMap: Record<string, string> = {
            '木': '创造力和生长感偏弱——有点「死鱼眼看世界」，需要多晒太阳',
            '火': '表达力和爆发力不足——开会发言像读说明书',
            '土': '稳定感和落地能力缺缺——计划做了一堆，执行全靠随缘',
            '金': '决断力和边界感偏弱——选个外卖都能纠结20分钟',
            '水': '灵活性和变通力不够——遇到变化容易CPU过载'
        };
        const domFunMap: Record<string, string> = {
            '木': '天生卷王体质，永远在「还能更好」的路上',
            '火': '行走的氛围组，走到哪儿热闹到哪儿',
            '土': '人间定海神针，朋友圈最靠谱的存在',
            '金': '人群中的清醒型选手，别人还在纠结你已经做完决定了',
            '水': '社交变色龙，什么圈子都能混'
        };
        const favTMap: Record<string, string[]> = {
            '木': ['多接触绿植、木质家居', '晨跑散步、春天多出门', '穿搭多用绿色系'],
            '火': ['适度运动出汗', '多社交多表达', '红色系穿搭加持'],
            '土': ['规律作息比补品管用', '做饭、园艺能充电', '黄棕色系穿搭更稳'],
            '金': ['定期断舍离', '做计划列清单搞复盘', '白银色系提升气场'],
            '水': ['多喝水（真不是玩梗）', '游泳泡澡靠近水域', '蓝黑色系穿搭自带buff']
        };
        const badTMap: Record<string, string> = {
            '木': '少冲动创业，种树也得等天时',
            '火': '控制脾气和冲动消费，别一上头就all in',
            '土': '别太固执，灵活变通比死磕更聪明',
            '金': '少做断舍离式的决定，砍掉的可能是命根子',
            '水': '少折腾方向，变来变去反而迷路'
        };
        const persFunMap: Record<string, string> = {
            '木': '你就是那种明明已经很累了还会说「我再看一下」的人',
            '火': '朋友圈里你是最会带节奏的——好的那种',
            '土': '所有人都慌的时候你是最稳的那个，但你的慢热确实让人着急',
            '金': '你的口头禅大概是「这不合理」——然后用逻辑说服所有人',
            '水': '「见人说人话，见鬼说鬼话」不是贬义，是你的天赋技能'
        };
        const weakFun = weakFunMap[es.weak] || '';
        const domFun = domFunMap[es.dom] || '';
        const favT = favTMap[dm.fav] || [];
        const badT = badTMap[dm.bad] || '';
        const persFun = persFunMap[dm.el] || '';
        const yearP = pil.year,
            monthP = pil.month;
        const ageLabel = selAge === reading.meta.curA ? `现年${selAge}岁` : `${selAge}岁（${cpYear}年）`;
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const tstDesc = reading.tst
            ? `<div class="${styles.secHeading}">真太阳时</div>出生地<b>${reading.tst.city}</b>，北京时间${pad2(reading.tst.origH)}:${pad2(reading.tst.origMin)} → 真太阳时<b>${pad2(reading.tst.corrH)}:${pad2(reading.tst.corrMin)}</b>（校正${reading.tst.correction >= 0 ? '+' : ''}${reading.tst.correction}分钟）。<br><br>`
            : '';
        const spouseHidden = pil.day.hidden || [];
        const mwData = buildMonthWealth(cp, pil, prof, dm, daYun, es);
        const bestWM = mwData.reduce((a, b) => (b.score > a.score ? b : a));
        const worstWM = mwData.reduce((a, b) => (b.score < a.score ? b : a));
        const mlData = buildMonthLove(cp, pil, prof, dm, daYun, es);
        const loveHeatmap = (() => {
            const lo = Math.min(...mlData.map(d => d.score)),
                hi = Math.max(...mlData.map(d => d.score));
            const rng = hi - lo || 1;
            return (
                `<div class="${styles.loveHeatmap}">` +
                mlData
                    .map(d => {
                        const t = (d.score - lo) / rng;
                        const bg = `rgba(242,53,141,${(0.08 + t * 0.55).toFixed(2)})`;
                        const fg = t > 0.5 ? '#8c0e4a' : '#b8447a';
                        return `<div class="${styles.loveHmCell}" style="background:${bg};color:${fg}"><div class="${styles.loveHmMonth}">${d.month}月</div><div class="${styles.loveHmScore}">${d.score}</div></div>`;
                    })
                    .join('') +
                '</div>'
            );
        })();
        const mcData = buildMonthCareer(cp, pil, prof, dm, daYun, es);
        const cScores = mcData.map(d => d.score);
        const cAvg = cScores.reduce((a, b) => a + b, 0) / 12;
        const cMx = Math.max(...cScores),
            cMn = Math.min(...cScores);
        const cHi = cAvg + (cMx - cAvg) * 0.45,
            cLo = cAvg - (cAvg - cMn) * 0.45;
        type SCarPhase = 'peak' | 'push' | 'steady' | 'gather' | 'wrap';
        const cPhaseOf = (v: number): SCarPhase =>
            v >= cHi + 3 ? 'peak' : v >= cHi ? 'push' : v <= cLo ? 'gather' : v <= cLo + 3 ? 'wrap' : 'steady';
        const cPhases = cScores.map(cPhaseOf);
        const cSegs: {phase: SCarPhase; start: number; end: number}[] = [];
        let cCur: {phase: SCarPhase; start: number; end: number} = {phase: cPhases[0], start: 0, end: 0};
        for (let i = 1; i < 12; i++) {
            if (cPhases[i] === cCur.phase) {
                cCur.end = i;
            } else {
                cSegs.push(cCur);
                cCur = {phase: cPhases[i], start: i, end: i};
            }
        }
        cSegs.push(cCur);
        const cCfg: Record<SCarPhase, {label: string; bg: string; fg: string}> = {
            peak: {label: '🔥 发力窗口', bg: 'linear-gradient(135deg,#4f46e5,#6366f1)', fg: '#fff'},
            push: {label: '推进期', bg: 'linear-gradient(135deg,#818cf8,#a5b4fc)', fg: '#fff'},
            steady: {label: '平稳期', bg: '#ddd6fe', fg: '#5b21b6'},
            gather: {label: '蓄力期', bg: '#ede9fe', fg: '#7c3aed'},
            wrap: {label: '收束期', bg: '#c7d2fe', fg: '#3730a3'}
        };
        const cPeakIdx = cScores.indexOf(cMx);
        let cStartM = 0;
        for (let i = 0; i < 12; i++) {
            if (cPhases[i] === 'push' || cPhases[i] === 'peak') {
                cStartM = i + 1;
                break;
            }
        }
        let cAdjustM = 0;
        for (let i = cPeakIdx + 1; i < 12; i++) {
            if (cPhases[i] === 'steady' || cPhases[i] === 'gather' || cPhases[i] === 'wrap') {
                cAdjustM = i + 1;
                break;
            }
        }
        const cPushMonths = mcData
            .filter(d => cPhaseOf(d.score) === 'peak' || cPhaseOf(d.score) === 'push')
            .map(d => d.month + '月');
        const cGatherMonths = mcData
            .filter(d => cPhaseOf(d.score) === 'gather' || cPhaseOf(d.score) === 'wrap')
            .map(d => d.month + '月');
        const careerBar = (() => {
            const track = cSegs
                .map(sg => {
                    const span = sg.end - sg.start + 1;
                    const c = cCfg[sg.phase];
                    const w = ((span / 12) * 100).toFixed(1);
                    return `<div class="${styles.careerBarSeg}" style="width:${w}%;background:${c.bg};color:${c.fg}">${span >= 2 ? c.label : span === 1 && sg.phase === 'peak' ? '🔥' : ''}</div>`;
                })
                .join('');
            const monthLabels = Array.from({length: 12}, (_, i) => `<span>${i + 1}月</span>`).join('');
            return `<div class="${styles.careerBarWrap}"><div class="${styles.careerBarTrack}">${track}</div><div class="${styles.careerBarMonths}">${monthLabels}</div></div>`;
        })();
        const rhythmText = (() => {
            if (!cPushMonths.length) {
                return '全年事业节奏偏平稳，无明显发力窗口，适合匀速推进、逐步积累。';
            }
            const pkM = cPeakIdx + 1;
            const pkYSi = (((getBaziYear(cp.year, pkM, 15) - 4) % 10) + 10) % 10;
            const pkMBi = pkM % 12;
            const pkMSi = getMonthStem(pkYSi, pkMBi);
            let t = `从月令干支与${dm.fav}（用神）的交互来看，<b>${cPushMonths.join('、')}</b>形成事业发力窗口`;
            if (cStartM) {
                t += `，<b>${cStartM}月</b>为启动节点`;
            }
            t += `，<b>${pkM}月</b>${STEMS[pkMSi]}${BRANCHES[pkMBi]}当令，事业能量达到峰值`;
            if (cAdjustM) {
                t += `；<b>${cAdjustM}月</b>起进入调整收束`;
            }
            if (cGatherMonths.length) {
                t += `。${cGatherMonths.join('、')}属于蓄力阶段，适合复盘和储备`;
            }
            return t + '。';
        })();
        function careerBlock(): string {
            const dyYear = curDY ? `<div class="${styles.secHeading}">大运分析</div>${dyDesc}<br><br>` : '';
            const lifeCareer = `<div class="${styles.secHeading}">事业总览</div>${es.dom}旺格局，${domGod}主导，${narr.c}。日主${dmS}，${dm.st ? '执行力和主导力偏强' : '善于借力合作、整合资源'}。用神<b>${dm.fav}</b>，适合关注${EA[dm.fav].ind}。`;
            if (selAge <= 6) {
                const yearTxt = `${ageLabel}，你正处于感知世界的阶段。${rhythmText}${lnDesc}今年整体运势<b>${s}分</b>（${band}），${s >= 85 ? '成长节奏顺畅，好奇心旺盛，适合接触更多新事物' : s >= 74 ? '成长稳步推进，保持规律的生活节奏就是最好的积累' : '可能有些小波折，更需要稳定作息、安全感和积极反馈'}。`;
                return `${lifeCareer}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年成长</div>${careerBar}${dyYear}${yearTxt}<br><br><div class="${styles.secHeading}">成长建议</div><ul class="${styles.adviceList}"><li>规律作息比任何早教课都管用</li><li>多接触自然和同龄人，这就是最好的课程</li><li>${cPushMonths.length ? cPushMonths.join('、') + '状态活跃，适合尝试新事物' : '全年节奏平稳，按部就班即可'}</li><li>${dm.fav}属性环境有加持——${EA[dm.fav].color}系的玩具和衣服可以多备</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>才${selAge}岁，唯一的KPI是健康快乐。${s >= 85 ? '老天给的底子不错，好好长就行。' : '急什么，人生才刚刚开机呢。'}</p></div>`;
            }
            if (selAge <= 12) {
                const yearTxt = `${ageLabel}。${lnDesc}今年学业运势<b>${s}分</b>（${band}），${rhythmText}${s >= 85 ? '学习状态全面在线，理解力和记忆力处于高峰，适合多拓展课外兴趣、发现天赋方向' : s >= 74 ? '学习节奏平稳，基础功扎实就够了，不必过度焦虑排名' : '学习上可能遇到卡点，换个方法、换个老师试试，别死磕一条路'}。`;
                return `${lifeCareer}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年学业</div>${careerBar}${dyYear}${yearTxt}<br><br><div class="${styles.secHeading}">学习建议</div><ul class="${styles.adviceList}"><li>${s >= 85 ? '状态好的时候多尝试新兴趣，发现天赋' : '先稳住主科，课外班别贪多'}</li><li>${cPushMonths.length ? '<b>' + cPushMonths.join('、') + '</b>学习效率最高，重要任务优先安排在此' : '全年学习节奏均匀，保持稳定输出'}</li><li>运动要保证——身体好成绩才能好</li><li>用神${dm.fav}属性的月份适合安排重要考试</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${s >= 85 ? '学霸体质初现，但别忘了出去疯玩也是正事。' : s >= 74 ? '成绩中等不是坏事，找到擅长的东西更重要。' : '暂时落后不代表以后不行，很多大佬小时候也只是普通孩子。'}</p></div>`;
            }
            if (selAge <= 18) {
                return (
                    `${lifeCareer}<div class="${styles.secSpacer}"></div>` +
                    (tl
                        ? `<div class="${styles.secHeading}">${cpYear}年学业</div>${careerBar}${dyYear}${ageLabel}。${lnDesc}今年学业运势<b>${s}分</b>（${band}），${rhythmText}${s >= 90 ? '学业能量拉满，思维活跃、效率极高，是冲击理想目标的绝佳时机，大胆争取' : s >= 78 ? '学习节奏稳健，持续输出就能出成绩，不需要特别激进，保持状态即可' : '学业压力偏大，心态比努力更重要，先调整好状态再发力'}。近三年走势偏${tl.td}，${tl.td === '上升' ? '势头向好，乘胜追击' : '需要耐心积累，厚积薄发'}。<br><br>`
                        : '') +
                    `<div class="${styles.secHeading}">行动建议</div><ul class="${styles.adviceList}"><li>${s >= 85 ? '集中火力冲目标，这是出成绩的年份' : '先稳基础，查漏补缺比刷难题有用'}</li><li>${cPushMonths.length ? '<b>' + cPushMonths.join('、') + '</b>学业能量最强，重要考试和冲刺优先安排在此' : '全年节奏均匀，保持稳定输出即可'}</li><li>${cAdjustM ? cAdjustM + '月后进入调整期，适合复盘总结、查漏补缺' : '作息规律比熬夜刷题效率高十倍'}</li><li>适当减压——运动、音乐、和朋友聊天都算</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${s >= 90 ? cpYear + '年是学业冲刺好时机，别客气直接冲。' : s >= 78 ? cpYear + '年稳着来，别跟别人比进度，跟昨天的自己比。' : cpYear + '年压力大很正常，深呼吸，你比想象中能打。'}</p></div>`
                );
            }
            if (selAge >= 61) {
                return (
                    `${lifeCareer}<div class="${styles.secSpacer}"></div>` +
                    (tl
                        ? `<div class="${styles.secHeading}">${cpYear}年生活</div>${careerBar}${dyYear}${ageLabel}。${lnDesc}今年生活运势<b>${s}分</b>（${band}），${rhythmText}${s >= 85 ? '精神状态不错，退休生活过得比上班还充实，适合发挥余热、参与社区活动' : s >= 74 ? '生活平稳有序，安安静静享受当下就很好' : '身体或精力可能有些波动，注意休息，少操心多享福'}。<br><br>`
                        : '') +
                    `<div class="${styles.secHeading}">生活建议</div><ul class="${styles.adviceList}"><li>${s >= 85 ? '精力好的话可以带带徒弟、做做顾问' : '养花遛弯下棋，怎么开心怎么来'}</li><li>${cPushMonths.length ? cPushMonths.join('、') + '精力较旺，适合安排社交活动或外出' : '全年节奏平稳，顺其自然就好'}</li><li>健康是一切的前提，定期体检不能省</li><li>多和老朋友聚聚，社交是最好的养生</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>都退休了还看事业运？${s >= 85 ? '行吧，你这精力确实还能再战。广场舞C位等着你。' : '放过自己吧，人生下半场的KPI只有一个：开心。'}</p></div>`
                );
            }
            return (
                `${lifeCareer}<div class="${styles.secSpacer}"></div>` +
                (tl
                    ? `<div class="${styles.secHeading}">${cpYear}年事业</div>${careerBar}${dyYear}${ageLabel}。${lnDesc}今年事业运势<b>${s}分</b>（${band}），${rhythmText}${s >= 90 ? '正处发力高点，事业能量充沛，适合争取晋升、拿下关键项目、扩大影响力' : s >= 78 ? '节奏平稳，适合打磨核心能力、积累行业口碑，稳扎稳打就是进步' : '宜守不宜攻，这一年的主题是复盘和储备，把基本盘守好就是胜利'}。近三年走势偏${tl.td}，${tl.td === '上升' ? '正处上升通道，宜主动出击' : tl.td === '下行' ? '调整期，以守代攻' : '稳步推进'}。黄金窗口<b>${tl.b5s}～${tl.b5e}岁</b>。<br><br>`
                    : '') +
                `<div class="${styles.secHeading}">行动建议</div><ul class="${styles.adviceList}"><li>${cPushMonths.length ? '<b>' + cPushMonths.join('、') + '</b>是年度事业发力窗口——晋升答辩、项目推进、关键谈判优先安排在此' : '全年节奏偏平稳，适合匀速推进、逐步积累'}</li><li>${cStartM ? '<b>' + cStartM + '月</b>事业能量启动，提前做好准备、卡好节奏' : '年初即可稳步推进，不必刻意等待窗口'}</li><li>${cAdjustM ? cAdjustM + '月后进入收束调整期，适合复盘总结、储备下一阶段资源' : '下半年延续势头，保持节奏即可'}</li><li>用神${dm.fav}旺的流年可侧重${EA[dm.fav].ind}</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${s >= 90 ? cpYear + '年事业运拉满，现在不冲更待何时？' + (tl ? tl.b5s + '到' + tl.b5e + '岁是黄金期，到时候请大家吃饭。' : '') : s >= 78 ? cpYear + '年稳着来就行，不用跟别人比速度。马拉松前半程跑太快反而崩。' : cpYear + '年属于「战略性摸鱼」阶段——不是不干，是把力气攒着等风来。'}</p></div>`
            );
        }
        function loveBlock(): string {
            const dyLove = curDY
                ? `<div class="${styles.secHeading}">大运感情</div>${dyDesc}${curDY.sEl === dm.fav || curDY.bEl === dm.fav ? '当前大运利感情发展。' : '当前大运感情运势需主动经营。'}<br><br>`
                : '';
            const lifeLove = `<div class="${styles.secHeading}">感情总览</div>${narr.l}。日主${dm.el}${dmS}，${dm.st ? '感情中主动性强，喜欢掌握节奏' : '更重安全感与情绪共鸣，需要稳定的关系'}。日支<b>${pil.day.branch}</b>为配偶宫，${spouseHidden.some(h => TEN_GOD_MAP[h.el] === '财星') ? '宫见财星，伴侣务实能干' : spouseHidden.some(h => TEN_GOD_MAP[h.el] === '官杀') ? '宫见官杀，伴侣有责任心' : spouseHidden.some(h => TEN_GOD_MAP[h.el] === '印星') ? '宫见印星，伴侣温和体贴' : '伴侣性格独立'}。`;
            if (selAge <= 6) {
                const yearTxt = `${ageLabel}，你在这个阶段主要通过家人和同龄互动建立安全感。${lnDesc}今年社交运势<b>${s}分</b>（${band}），${s >= 85 ? '亲和力较强，更容易融入身边的互动' : s >= 74 ? '社交能力稳步发展，开始学会分享和表达' : '可能会有些认生或敏感，更需要熟悉的环境和稳定的安全感'}。`;
                return `${lifeLove}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年社交</div>${loveHeatmap}${yearTxt}<br><br><div class="${styles.secHeading}">社交建议</div><ul class="${styles.adviceList}"><li>多参与轻松自然的同龄互动</li><li>在游戏中练习分享和表达</li><li>稳定的安全感会让你更敢于探索和交往</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>这个阶段的社交核心就是一起玩。你会在游戏和互动里慢慢学会表达、分享和建立关系。</p></div>`;
            }
            if (selAge <= 12) {
                const yearTxt = `${ageLabel}。${lnDesc}今年社交运势<b>${s}分</b>（${band}），${s >= 85 ? '人缘较好，在集体中容易被注意和接纳' : s >= 74 ? '同学关系融洽，朋友圈相对稳定' : '可能会遇到一些社交摩擦，学会处理矛盾比一味回避更重要'}。`;
                return `${lifeLove}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年社交</div>${loveHeatmap}${yearTxt}<br><br><div class="${styles.secHeading}">社交建议</div><ul class="${styles.adviceList}"><li>可以参加团队活动和集体运动</li><li>遇到冲突时，先表达感受再讨论问题</li><li>${dm.st ? '注意别太强势，也给别人表达的空间' : '可以更主动表达，不用总迁就别人'}</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>这个阶段的友情开始变得复杂。${dm.st ? '你有带动大家的能力，但也要记得倾听。' : '你心思细腻，会认真对待真正认可的朋友。'}</p></div>`;
            }
            if (selAge <= 18) {
                return (
                    `${lifeLove}<div class="${styles.secSpacer}"></div>` +
                    (tl
                        ? `<div class="${styles.secHeading}">${cpYear}年人际</div>${loveHeatmap}${dyLove}${ageLabel}。${lnDesc}今年人际运势<b>${s}分</b>，${s >= 85 ? '人际关系顺畅，社交圈活跃，可能会遇到对你很重要的人，值得用心经营' : s >= 74 ? '社交圈平稳，保持真诚待人就好，不必刻意讨好谁' : '人际上可能有些波动，同学关系或朋友圈里会有摩擦，别太在意流言蜚语，做好自己'}。<br><br>`
                        : '') +
                    `<div class="${styles.secHeading}">社交建议</div><ul class="${styles.adviceList}"><li>这个年纪友情比爱情重要得多</li><li>${s >= 85 ? '人缘好的时候多帮帮同学，这些人脉以后会回来找你' : '交几个真心朋友比认识一堆人强'}</li><li>${dm.st ? '控制表达欲，听别人说完再发表意见' : '有想法就大胆说，别总闷在心里'}</li><li>任何关系都不值得影响学业和心情</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>青春期的关系特别像过山车——${dm.st ? '你可能是那个带节奏的人，注意别把别人甩飞了。' : '你可能是那个默默观察的人，但你的温柔其实很有力量。'}${s >= 85 ? ' 今年社交运不错，有些人值得深交。' : ''}</p></div>`
                );
            }
            if (selAge >= 61) {
                return (
                    `${lifeLove}<div class="${styles.secSpacer}"></div>` +
                    (tl
                        ? `<div class="${styles.secHeading}">${cpYear}年家庭</div>${loveHeatmap}${dyLove}${ageLabel}。${lnDesc}今年家庭运势<b>${s}分</b>，${s >= 85 ? '家庭关系和谐温馨，儿孙绕膝的幸福感在线，和老伴的默契也在加深' : s >= 74 ? '生活平静安稳，和家人、老朋友相处融洽，日子过得不急不躁' : '可能会有些孤独感或家庭小摩擦，主动找人聊聊天，别闷在心里'}。<br><br>`
                        : '') +
                    `<div class="${styles.secHeading}">生活建议</div><ul class="${styles.adviceList}"><li>老伴是最大的财富，互相包容别计较</li><li>多和子女沟通，但别过度干涉他们的生活</li><li>培养社交圈——老年大学、棋友茶友都很好</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${s >= 85 ? '晚年幸福指数在线，有人陪有事做有期待，这就是最好的状态。' : '一个人也没什么不好，但偶尔找人下盘棋聊聊天，比看电视养生多了。'}</p></div>`
                );
            }
            return (
                `${lifeLove}<div class="${styles.secSpacer}"></div>` +
                (tl
                    ? `<div class="${styles.secHeading}">${cpYear}年感情</div>${loveHeatmap}${dyLove}${ageLabel}。${lnDesc}今年感情运势<b>${s}分</b>，${s >= 85 ? '互动能量充足，关系中的推进力很强，适合做重大感情决策——表白、确认关系、婚嫁等关键节点都宜安排在今年' : s >= 74 ? '感情节奏平稳，没有大的波澜，经营好日常细节比搞大动作更重要，用心陪伴胜过一切仪式感' : '精力有限，感情上容易力不从心，先照顾好自己的状态和情绪，稳定了再去经营关系'}。近三年感情走势偏${tl.td}。<br><br>`
                    : '') +
                `<div class="${styles.secHeading}">行动建议</div><ul class="${styles.adviceList}"><li>高分年适合做重大感情决策、推进关键节点</li><li>平稳年是关系维护期，经营细节比表态重要</li><li>低分年先照顾好自己的状态</li><li>择偶宜找${dm.st ? '能包容和柔化你的人，适当示弱反而更有吸引力' : '能给予支持和安全感的人，保持自我比过度迁就更重要'}</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${dm.st ? '你在感情里属于「带头大哥/大姐」型，偶尔示弱一下对方会更爱你。强不是问题，让对方觉得被需要才是真课题。' : '你在感情里需要安全感，这不丢人。找一个让你安心的人比找一个让你心动的人更重要——心动会退潮，安心才是永动机。'}</p></div>`
            );
        }
        function wealthBlock(): string {
            const dyWealthPart = curDY
                ? `<div class="${styles.secHeading}">大运财运</div>当前大运<b>${curDY.stem}${curDY.branch}</b>（${curDY.sEl}${curDY.bEl}），${curDY.sEl === GEN_MAP[dm.el] || curDY.bEl === GEN_MAP[dm.el] ? '大运见财星，求财机会增多' : curDY.sEl === dm.fav || curDY.bEl === dm.fav ? '大运见用神，整体运势对财运有间接助力' : '大运未直接助财，需靠个人努力开拓'}。<br><br>`
                : `${daYun.startAge}岁起运前，受月柱<b>${pil.month.stem}${pil.month.branch}</b>影响为主。<br><br>`;
            const lifeWealth = `<div class="${styles.secHeading}">财富总览</div>${narr.w}。五行中<b>${GEN_MAP[dm.el]}</b>为财星（我克者为财），命局中${GEN_MAP[dm.el]}气${prof[GEN_MAP[dm.el]].toFixed(1)}分，${prof[GEN_MAP[dm.el]] >= 2 ? '财星有力，求财有门路' : prof[GEN_MAP[dm.el]] >= 0.5 ? '财星偏弱，需借大运流年之力' : '财星极弱，财运依托大运补充'}。日主${dmS}，${dm.st ? '身强能担财，风险承受力较强' : '身弱宜谨慎理财，量入为出'}。`;
            if (selAge <= 6) {
                const yearTxt = `${ageLabel}，这个阶段的“财运”主要体现在零花钱、压岁钱和物质满足感上。${lnDesc}今年运势<b>${s}分</b>（${band}），${s >= 85 ? '获得零花钱或礼物的机会相对多一些' : s >= 74 ? '整体中规中矩，满足日常需要没有问题' : '可支配的部分可能较少，很多仍由家人安排'}。`;
                return `${lifeWealth}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年"财运"</div><div class="${styles.wealthChartWrap}"><canvas id="wealthMC"></canvas></div>${yearTxt}<br><br><div class="${styles.secHeading}">理财启蒙</div><ul class="${styles.adviceList}"><li>开始认识钱——知道钱能买东西就是巨大进步</li><li>准备一个存钱罐，培养攒钱意识</li><li>别太早开始比较谁的玩具多</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>现阶段最大的资产是无限的可能性。压岁钱被没收不算亏，长大了自己赚回来。</p></div>`;
            }
            if (selAge <= 12) {
                const yearTxt = `${ageLabel}。${lnDesc}今年"财运"<b>${s}分</b>（${band}），${s >= 85 ? '零花钱管理状态不错，也更容易攒下自己的小金库' : s >= 74 ? '收支基本平衡，偶尔超支但整体可控' : s >= 68 ? '容易出现前松后紧的情况，需要提前规划' : '经济仍主要依赖家里，现阶段把重点放在学习和成长即可'}。`;
                return `${lifeWealth}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年"财运"</div><div class="${styles.wealthChartWrap}"><canvas id="wealthMC"></canvas></div>${yearTxt}<br><br><div class="${styles.secHeading}">理财建议</div><ul class="${styles.adviceList}"><li>学会记账——知道钱花在哪里比攒多少更重要</li><li>区分「想要」和「需要」，这个能力受用终身</li><li>可以尝试用零花钱做小目标储蓄</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>现在学会管理零花钱，未来面对更大的金额会更从容。${dm.st ? '你花钱比较有主见，也要给储蓄留出固定位置。' : '你在花钱前会多想一步，这能减少不少冲动消费。'}</p></div>`;
            }
            if (selAge <= 18) {
                const yearTxt = `${ageLabel}。${lnDesc}今年财务运势<b>${s}分</b>（${band}），${s >= 85 ? '生活费管理得当，可能还有余钱，理财意识开始萌芽' : s >= 74 ? '收支基本平衡，没什么大问题' : '可能会有些意料外的开支，学会控制冲动消费很关键'}。全年来看，<b style="color:#16a34a">${bestWM.month}月</b>财务状态最好（${bestWM.score}分），<b style="color:#dc2626">${worstWM.month}月</b>偏紧（${worstWM.score}分）。`;
                return `${lifeWealth}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年财务</div><div class="${styles.wealthChartWrap}"><canvas id="wealthMC"></canvas></div>${dyWealthPart}${yearTxt}<br><br><div class="${styles.secHeading}">理财建议</div><ul class="${styles.adviceList}"><li>学会规划生活费——月初分配比月底借钱强</li><li>${bestWM.month}月如果有想买的大件可以考虑出手</li><li>${worstWM.month}月少逛淘宝，控制冲动消费</li><li>可以尝试了解基本理财概念，为将来打基础</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>这个年纪不用想太多理财的事，但${s >= 85 ? '你的财务敏感度不错，以后搞钱应该有天赋。' : '至少别月初奶茶自由月底泡面续命就行。'}学会延迟满足比什么理财课都管用。</p></div>`;
            }
            return (
                `${lifeWealth}<div class="${styles.secSpacer}"></div><div class="${styles.secHeading}">${cpYear}年财运</div><div class="${styles.wealthChartWrap}"><canvas id="wealthMC"></canvas></div>${dyWealthPart}${ageLabel}。${lnDesc}今年财运<b>${s}分</b>（${band}），${s >= 90 ? '财务弹性大，收入渠道活跃，适合主动争取加薪、推动投资配置、把握关键财务机会' : s >= 78 ? '财运平稳，没有大起大落，适合优化资产结构、增加储蓄比例，稳中求进' : '需严控支出，避免大额投资和借贷，守住现有基本盘就是这一年最大的胜利'}。` +
                (tl ? `财运最佳窗口<b>${tl.b5s}～${tl.b5e}岁</b>。` : '') +
                `全年走势来看，<b style="color:#16a34a">${bestWM.month}月</b>财运最旺（${bestWM.score}分），适合争取关键收入、推动重要财务决策；<b style="color:#dc2626">${worstWM.month}月</b>偏弱（${worstWM.score}分），宜保守理财、控制开支。<br><br><div class="${styles.secHeading}">行动建议</div><ul class="${styles.adviceList}"><li>高分月重点出击：<b>${bestWM.month}月</b>前后适合谈薪、签约、推进重要项目</li><li>低分月防守为主：<b>${worstWM.month}月</b>前后控制大额支出，避免冲动投资</li><li>${dm.st ? '身强能担财，可适度扩大投资半径' : '身弱需谨慎，量入为出、稳健配置优先'}</li><li>用神${dm.fav}旺的月份可关注${EA[dm.fav].ind}</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${s >= 85 ? cpYear + '年财运不错，但「不错」≠「随便浪」。重点盯住' + bestWM.month + '月这波机会，趁运气好多攒点。' : cpYear + '年不是搞钱最佳时机，' + worstWM.month + '月尤其别冲动。'}${tl ? ' ' + tl.b5s + '到' + tl.b5e + '岁是最能搞钱的阶段，现在的准备都在给那时候铺路。' : ''}</p></div>`
            );
        }
        const moveVisualToTop = (content: string, visual: string) => {
            const visualIndex = content.indexOf(visual);
            if (visualIndex < 0) return content;
            const headingStart = content.lastIndexOf(`<div class="${styles.secHeading}">`, visualIndex);
            if (headingStart < 0) return visual + content.replace(visual, '');
            const visualEnd = visualIndex + visual.length;
            const visualBlock = content.slice(headingStart, visualEnd);
            return visualBlock + content.slice(0, headingStart) + content.slice(visualEnd);
        };
        if (activeSection === 'summary') {
            return `${infoBlock}<div class="${styles.elBars}">${elBarsHtml}</div><div class="${styles.sectionDivider}"></div>${tstDesc}<div class="${styles.secHeading}">底层结构</div>日主<b>${dm.stem}${dm.el}</b>，${dmS}，${narr.p}。命局中<b>${es.dom}</b>气最旺（${prof[es.dom].toFixed(1)}），对应${domGod}——${godDesc[domGod] || ''}；<b>${es.weak}</b>最弱（${prof[es.weak].toFixed(1)}），${weakFun.split('——')[0]}。${missing.length ? `命局<b>缺${missing.join('、')}</b>，需要在不同人生阶段借力补充。` : '五行俱全，整体结构较完整。'}平衡度<b>${es.bal}分</b>，${balD}。<br><br>用神取<b>${dm.fav}</b>——${EA[dm.fav].color}、${EA[dm.fav].dir}方位更贴合你的节奏；忌神为<b>${dm.bad}</b>，${badT}。${dm.st ? '你的长期优势是执行力和主导力，也要给自己留出缓冲空间' : '你的长期优势是观察和借力，选对平台往往比硬扛更有效'}。<div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">核心特征</span></p><p>${domFun}。${weakFun}。整体属于<b>${es.dom}</b>型结构，${dm.st ? '能量充足，适合把力量集中到真正重要的方向' : '感知细腻，借助环境与伙伴更容易发挥优势'}。</p></div>`;
        }
        if (activeSection === 'personality') {
            return `<div class="${styles.radarWrap}"><canvas id="radarChart"></canvas></div><div class="${styles.secHeading}">性格总结</div>日主<b>${dm.stem}${dm.el}</b>，${dmS}。${narr.p}。五行中<b>${es.dom}</b>气最旺（${prof[es.dom].toFixed(1)}），对应${domGod}——${godDesc[domGod] || ''}；<b>${es.weak}</b>最弱（${prof[es.weak].toFixed(1)}），对应${weakGod}——容易在相关事务上节奏卡顿。${dm.st ? '偏主动型选手——决策快、执行力强、喜欢掌控节奏，但有时候刚过头容易把人怼走，大事面前缓一拍反而更稳' : '偏内敛型选手——思虑细腻、观察力强、做事讲铺垫，但关键时刻容易犹豫拖延，需要有人推一把或者自己逼自己一下'}。年柱${yearP.sEl}气奠定了从小的性格底色，月柱${monthP.sEl}气决定了在外人面前的人设。<br><br><div class="${styles.secHeading}">优势与短板</div><ul class="${styles.adviceList}"><li><b>核心天赋：</b>${es.dom}旺 → ${domFun}</li><li><b>容易卡壳：</b>${es.weak}弱 → ${weakFun}</li><li><b>社交风格：</b>${dm.st ? '天生带点气场，别人容易被你说服或者被你吓到' : '天生亲和力不错，但有时候太在意别人感受反而消耗自己'}</li>${missing.length ? `<li><b>缺失五行：</b>${missing.join('、')}偏弱——${missingTxt}</li>` : ''}</ul><br><div class="${styles.secHeading}">开运指南</div><ul class="${styles.adviceList}"><li>用神<b>${dm.fav}</b>加持：${favT.join('、')}</li><li>忌神<b>${dm.bad}</b>避雷：${badT}</li><li>五行平衡度${es.bal}分——${es.bal >= 85 ? '格局端正，顺着自己节奏走就好' : '有意识补短板，多借用神属性的外力来平衡'}</li></ul><div class="${styles.tipBox}"><p><span class="${styles.tipLabel}">💬 说人话</span></p><p>${persFun}。${es.dom}旺的人${domFun.toLowerCase()}。缺${es.weak}的副作用：${weakFun.toLowerCase()}。简单说就是——你的出厂设置${dm.st ? '自带主角光环，但记得给配角留点戏份' : '是辅助型天赋，但别小看自己，关键时刻你才是团队的定心丸'}。</p></div>`;
        }
        if (activeSection === 'career') {
            return moveVisualToTop(careerBlock(), careerBar);
        }
        if (activeSection === 'love') {
            return moveVisualToTop(loveBlock(), loveHeatmap);
        }
        if (activeSection === 'wealth') {
            const chart = `<div class="${styles.wealthChartWrap}"><canvas id="wealthMC"></canvas></div>`;
            return moveVisualToTop(wealthBlock(), chart);
        }
        return '';
    })();

    /* ── Tooltip brief ── */
    const tooltipBrief = reading?.yearBriefs.find(i => i.age === selAge)?.text || '';

    /* ── Section tab labels (age-aware) ── */
    const sectionLabels: Record<string, string> = {
        summary: '总览',
        personality: '性格',
        career: selAge <= 18 ? '学业' : '事业',
        love: selAge <= 12 ? '社交' : selAge <= 18 ? '人际' : '感情',
        wealth: selAge <= 12 ? '零花钱' : selAge <= 18 ? '财务' : '财富'
    };

    /* ── After rendering section, bind canvas refs ── */
    useEffect(() => {
        if (!readingRef.current) {
            return;
        }
        const rc = readingRef.current.querySelector('#radarChart') as HTMLCanvasElement | null;
        if (rc && radarRef.current !== rc) {
            (radarRef as React.MutableRefObject<HTMLCanvasElement | null>).current = rc;
            drawRadarChart();
        }
        const wc = readingRef.current.querySelector('#wealthMC') as HTMLCanvasElement | null;
        if (wc && wealthRef.current !== wc) {
            (wealthRef as React.MutableRefObject<HTMLCanvasElement | null>).current = wc;
            if (reading) {
                const pt = reading.charts.line.find(i => i.age === selAge);
                if (pt) {
                    const mw = buildMonthWealth(
                        pt,
                        reading.pillars,
                        reading.profile,
                        reading.dm,
                        reading.daYun,
                        reading.es
                    );
                    drawWealthChart(mw);
                }
            }
        }
    }, [sectionHtml, drawRadarChart, drawWealthChart, reading, selAge]);

    return (
        <>
            <Head>
                <title>人生数据看板</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
                />
            </Head>
            <div className={`${styles.page} ${!showResult ? styles.pageHome : styles.pageResult}`}>
                {/* ── Hero Form ── */}
                {!showResult && (
                    <div className={`${styles.hero} ${styles.heroHome}`}>
                        <div className={styles.eyebrow}>LIFE · DATA · DASHBOARD</div>
                        <h1 className={styles.heroTitle}>人生数据看板</h1>
                        <div className={styles.desc}>
                            在时间的轨迹中，读取人生的起伏
                        </div>
                        <div className={styles.heroMeta}>
                            <span>八字命理</span><i />
                            <span>人生走势</span><i />
                            <span>四维解析</span>
                        </div>
                    </div>
                )}
                {/* ── Form Panel ── */}
                {!showResult && (
                    <div className={styles.panel}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>姓名</label>
                            <input
                                className={styles.fieldInput}
                                placeholder="请输入姓名"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>性别</label>
                            <div className={styles.chips}>
                                {(['female', 'male'] as const).map(g => (
                                    <button
                                        type="button"
                                        key={g}
                                        className={`${styles.chip} ${gender === g ? styles.chipActive : ''}`}
                                        style={
                                            gender === g
                                                ? {
                                                      color: 'rgba(255,255,255,1)',
                                                      WebkitTextFillColor: 'rgba(255,255,255,1)'
                                                  }
                                                : {color: 'var(--text-primary)', WebkitTextFillColor: 'unset'}
                                        }
                                        onClick={() => {
                                            setGender(g);
                                            log('click', 'new_agent', {action_type: 'option_select'});
                                        }}
                                    >
                                        {g === 'female' ? '女' : '男'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>出生日期（公历）</label>
                            <input
                                className={`${styles.fieldInput} ${styles.dateTimeInput}`}
                                type="date"
                                placeholder="年月日"
                                max={new Date().toISOString().split('T')[0]}
                                value={birthDate}
                                onChange={e => setBirthDate(e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>出生时间</label>
                            <input
                                ref={timeInputRef}
                                className={`${styles.fieldInput} ${styles.dateTimeInput}`}
                                type="time"
                                placeholder="--:--"
                                max={(() => {
                                    const n = new Date();
                                    const todayLocal = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
                                    if (birthDate !== todayLocal) {
                                        return undefined;
                                    }
                                    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
                                })()}
                                value={birthTime}
                                onChange={e => {
                                    const val = e.target.value;
                                    const n = new Date();
                                    const todayLocal = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
                                    if (birthDate === todayLocal) {
                                        const nowStr = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
                                        if (val > nowStr) {
                                            NewAppBridge.toast.info('出生时间不能选择未来');
                                            setBirthTime(nowStr);
                                            if (timeInputRef.current) {
                                                timeInputRef.current.value = nowStr;
                                            }
                                            return;
                                        }
                                    }
                                    setBirthTime(val);
                                }}
                            />
                        </div>
                        <div className={`${styles.field} ${styles.fieldLast}`}>
                            <label className={styles.fieldLabel}>出生地</label>
                            <div className={styles.bpRow}>
                                <select
                                    className={styles.fieldSelect}
                                    value={province}
                                    onChange={e => {
                                        setProvince(e.target.value);
                                        setCity('');
                                        setCityName('');
                                    }}
                                >
                                    <option value="">省份</option>
                                    {PROV_CITIES.map(([p]) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className={styles.fieldSelect}
                                    value={city}
                                    onChange={e => {
                                        setCity(e.target.value);
                                        const opt = e.target.options[e.target.selectedIndex];
                                        setCityName(opt?.text || '');
                                    }}
                                >
                                    <option value="">城市</option>
                                    {cities.map(([cName, lng]) => (
                                        <option key={cName} value={lng}>
                                            {cName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className={styles.privacyNote}>信息仅用于本次图谱生成，不会被保存</div>
                        <button className={styles.button} onClick={handleGenerate}>
                            <span>生成我的人生数据看板</span>
                            <span className={styles.buttonArrow}>→</span>
                        </button>
                    </div>
                )}

                {/* ── Result View ── */}
                {showResult && reading && (
                    <>
                        {dashboardTab === 'life' && (
                            <div className={`${styles.dashboardView} ${styles.lifeView}`}>
                                <div className={styles.viewIntro}>
                                    <div><span>人生大盘</span><b>看长期趋势与底层结构</b></div>
                                    <div className={styles.lifeHeaderActions}>
                                        <em>{reading.name}</em>
                                        <button className={styles.lifeHeaderShare} onClick={() => openShare('life')}>分享数据图</button>
                                    </div>
                                </div>
                                <div className={`${styles.panel} ${styles.chartPanel}`}>
                                    <div className={styles.chartHeader}>
                                        <div className={styles.chartModeTabs}>
                                            {(['kline', 'line'] as const).map(m => (
                                                <button key={m} className={`${styles.chartModeTab} ${chartMode === m ? styles.chartModeTabActive : ''}`} onClick={() => setChartMode(m)}>
                                                    {m === 'kline' ? 'K线' : '折线'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className={styles.desktopZoomControls} aria-label="图表缩放">
                                            <button aria-label="缩小图表" disabled={pointGap <= MIN_GAP} onClick={() => setPointGap(gap => Math.max(MIN_GAP, gap - 2))}>−</button>
                                            <span>{Math.round(pointGap / DEFAULT_GAP * 100)}%</span>
                                            <button aria-label="放大图表" disabled={pointGap >= MAX_GAP} onClick={() => setPointGap(gap => Math.min(MAX_GAP, gap + 2))}>＋</button>
                                            <button className={styles.zoomReset} onClick={() => setPointGap(DEFAULT_GAP)}>重置</button>
                                        </div>
                                    </div>
                                    <div className={styles.chartPlotShell}>
                                        <div className={styles.chartYAxis} aria-hidden="true">
                                            {[98, 85, 75, 65, 55].map(value => (
                                                <span key={value} style={{top: `${yOf(value, CH) - 6}px`}}>{value}</span>
                                            ))}
                                        </div>
                                        <div className={styles.chartScroll} ref={scrollRef}>
                                            <div className={styles.chartWrap}>
                                                <canvas className={styles.canvas} ref={chartRef} onClick={handleChartClick} />
                                            </div>
                                        </div>
                                    </div>
                                    <div ref={tooltipRef} className={`${styles.tooltipCard} ${selAge ? '' : styles.tooltipCardHidden}`}>
                                        <div className={styles.tooltipYear}>{selYear}年 · <b>{selScore}</b>分</div>
                                        <div className={styles.tooltipScore}>{tooltipBrief}</div>
                                    </div>
                                    <div className={styles.chartFooterRow}>
                                        <span>双指缩放 · 滑动平移</span>
                                        <button onClick={() => { setActiveSection('career'); setDashboardTab('year'); window.scrollTo({top: 0, behavior: 'smooth'}); }}>
                                            查看当前年度详情 →
                                        </button>
                                    </div>
                                </div>
                                {(() => {
                                    const series = reading.charts.line;
                                    const current = series.find(point => point.age === selAge) || series[0];
                                    const highest = series.reduce((best, point) => point.score > best.score ? point : best, series[0]);
                                    const lowest = series.reduce((low, point) => point.score < low.score ? point : low, series[0]);
                                    const dims = buildDimScores(current, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
                                    const average = Math.round(series.reduce((sum, point) => sum + point.score, 0) / series.length);
                                    const currentIndex = Math.max(0, series.findIndex(point => point.age === current.age));
                                    const compareIndex = Math.max(0, currentIndex - 3);
                                    const delta = current.score - series[compareIndex].score;
                                    const trend = delta >= 3 ? '处于上升' : delta <= -3 ? '有所回落' : '区间震荡';
                                    return (
                                        <aside className={`${styles.panel} ${styles.lifeMetricsPanel}`} aria-label="人生关键指标">
                                            <div className={styles.lifeMetricsHead}>
                                                <div><span>当前趋势</span><b>{trend}</b></div>
                                                <strong>{current.score}<small>分</small></strong>
                                            </div>
                                            <div className={styles.lifeMetricsYear}>{current.year}年 · {current.age}岁</div>
                                            <div className={styles.lifeOverviewStats}>
                                                <div><span>人生均值</span><b>{average}分</b></div>
                                                <div><span>趋势高点</span><b>{highest.year}年</b><em>{highest.age}岁 · {highest.score}分</em></div>
                                                <div><span>相对低点</span><b>{lowest.year}年</b><em>{lowest.age}岁 · {lowest.score}分</em></div>
                                            </div>
                                            <div className={styles.lifeMetricsBrief}>
                                                <b>{current.year}年 · {current.score}分</b>
                                                <p>{tooltipBrief}</p>
                                            </div>
                                            <div className={styles.lifeMetricGrid}>
                                                {([
                                                    ['事业', dims.career],
                                                    ['财富', dims.wealth],
                                                    ['感情', dims.love],
                                                    ['健康', dims.health]
                                                ] as const).map(([label, value]) => (
                                                    <div key={label}><span>{label}</span><b>{value}</b></div>
                                                ))}
                                            </div>
                                        </aside>
                                    );
                                })()}
                                <div className={`${styles.panel} ${styles.analysisPanel}`}>
                                    <div className={styles.panelTitle}>我的底层数据</div>
                                    <div className={styles.sectionTabs}>
                                        {(['summary', 'personality'] as const).map(sec => (
                                            <button key={sec} className={`${styles.sectionTab} ${activeSection === sec ? styles.sectionTabActive : ''}`} onClick={() => setActiveSection(sec)}>
                                                {sec === 'summary' ? '五行四柱' : '性格特征'}
                                            </button>
                                        ))}
                                    </div>
                                    <div ref={readingRef}><div className={styles.readingCard}><div className={styles.readingContent} dangerouslySetInnerHTML={{__html: sectionHtml}} /></div></div>
                                </div>
                            </div>
                        )}

                        {dashboardTab === 'year' && (
                            <div className={`${styles.dashboardView} ${styles.yearView}`}>
                                <div className={styles.viewIntro}>
                                    <div><span>{selYear}年度详情</span><b>{selAge}岁 · 选择年份查看对应数据</b></div>
                                    <div className={styles.yearHeaderActions}>
                                        <details className={styles.yearSelectMenu}>
                                            <summary aria-label="切换年份">{selYear}年 · {selAge}岁</summary>
                                            <div className={styles.yearOptions}>
                                                {reading.charts.line.map(point => (
                                                    <button
                                                        key={point.age}
                                                        type="button"
                                                        className={point.age === selAge ? styles.yearOptionActive : ''}
                                                        onClick={e => {
                                                            setSelAge(point.age);
                                                            setSelYear(point.year);
                                                            setSelScore(point.score);
                                                            e.currentTarget.closest('details')?.removeAttribute('open');
                                                        }}
                                                    >
                                                        <span>{point.year}年</span><small>{point.age}岁</small>
                                                    </button>
                                                ))}
                                            </div>
                                        </details>
                                        <button className={styles.yearHeaderShare} onClick={() => openShare('year')}>分享数据图</button>
                                    </div>
                                </div>
                                <div className={styles.yearLeftStack}>
                                    <div className={`${styles.panel} ${styles.yearOverviewPanel}`}>
                                        <div className={styles.ringHeader} dangerouslySetInnerHTML={{__html: ringHeaderHtml}} />
                                        <div className={styles.ringLayout}>
                                            <div className={styles.ringLeft}><canvas ref={ringRef} /></div>
                                            <div className={styles.ringRight} dangerouslySetInnerHTML={{__html: ringRightHtml}} />
                                        </div>
                                    </div>
                                </div>
                                <div className={`${styles.panel} ${styles.yearInsightPanel}`}>
                                    <div className={styles.yearInsight} dangerouslySetInnerHTML={{__html: yearInsightHtml}} />
                                </div>
                                <div className={`${styles.panel} ${styles.analysisPanel}`}>
                                    <div className={styles.panelTitle}>年度维度</div>
                                    {(() => {
                                        const point = reading.charts.line.find(item => item.age === selAge) || reading.charts.line[0];
                                        const scores = buildDimScores(point, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
                                        const currentDim = (['career', 'love', 'wealth'] as const).includes(activeSection as 'career' | 'love' | 'wealth')
                                            ? activeSection as 'career' | 'love' | 'wealth'
                                            : 'career';
                                        const monthly = currentDim === 'career'
                                            ? buildMonthCareer(point, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es)
                                            : currentDim === 'love'
                                              ? buildMonthLove(point, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es)
                                              : buildMonthWealth(point, reading.pillars, reading.profile, reading.dm, reading.daYun, reading.es);
                                        const best = monthly.reduce((a, b) => b.score > a.score ? b : a);
                                        const low = monthly.reduce((a, b) => b.score < a.score ? b : a);
                                        const firstAvg = monthly.slice(0, 6).reduce((sum, item) => sum + item.score, 0) / 6;
                                        const lastAvg = monthly.slice(6).reduce((sum, item) => sum + item.score, 0) / 6;
                                        const trend = lastAvg - firstAvg > 2 ? '后程走强' : firstAvg - lastAvg > 2 ? '前高后稳' : '整体平稳';
                                        return (
                                            <>
                                                <div className={styles.sectionTabs}>
                                                    {(['career', 'love', 'wealth'] as const).map(sec => (
                                                        <button key={sec} className={`${styles.sectionTab} ${activeSection === sec ? styles.sectionTabActive : ''}`} onClick={() => setActiveSection(sec)}>
                                                            {sectionLabels[sec]}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={styles.dimensionSummary}>
                                                    <div><span>年度得分</span><b>{ds(scores)[currentDim]}</b></div>
                                                    <div><span>高峰月份</span><b>{best.month}月</b><small>{best.score}分</small></div>
                                                    <div><span>相对低点</span><b>{low.month}月</b><small>{low.score}分</small></div>
                                                    <div><span>年度走势</span><b>{trend}</b></div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    <div ref={readingRef}><div className={styles.readingCard}><div className={styles.readingContent} dangerouslySetInnerHTML={{__html: sectionHtml}} /></div></div>
                                </div>
                                <button className={`${styles.button} ${styles.resultSaveButton} ${styles.mobileYearShare}`} onClick={() => openShare('year')}>分享{selYear}年度数据图</button>
                            </div>
                        )}

                        {dashboardTab === 'profile' && (
                            <div className={`${styles.dashboardView} ${styles.profileView}`}>
                                <div className={styles.profileHero}>
                                    <div className={styles.profileAvatar}>{(name || '未').slice(0, 1)}</div>
                                    <div><span>{name || '未命名'}</span><b>个人信息与看板数据源</b></div>
                                </div>
                                <div className={`${styles.panel} ${styles.profilePanel}`}>
                                    <div className={styles.panelTitle}>个人信息</div>
                                    <div className={styles.field}>
                                        <label className={styles.fieldLabel}>姓名</label>
                                        <input className={styles.fieldInput} placeholder="请输入姓名" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.fieldLabel}>性别</label>
                                        <div className={styles.chips}>
                                            {(['female', 'male'] as const).map(g => (
                                                <button type="button" key={g} className={`${styles.chip} ${gender === g ? styles.chipActive : ''}`} onClick={() => setGender(g)}>
                                                    {g === 'female' ? '女' : '男'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.fieldLabel}>出生日期（公历）</label>
                                        <input className={`${styles.fieldInput} ${styles.dateTimeInput}`} type="date" max={new Date().toISOString().split('T')[0]} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.fieldLabel}>出生时间</label>
                                        <input ref={timeInputRef} className={`${styles.fieldInput} ${styles.dateTimeInput}`} type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} />
                                    </div>
                                    <div className={`${styles.field} ${styles.fieldLast}`}>
                                        <label className={styles.fieldLabel}>出生地</label>
                                        <div className={styles.bpRow}>
                                            <select className={styles.fieldSelect} value={province} onChange={e => { setProvince(e.target.value); setCity(''); setCityName(''); }}>
                                                <option value="">省份</option>
                                                {PROV_CITIES.map(([p]) => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <select className={styles.fieldSelect} value={city} onChange={e => { setCity(e.target.value); setCityName(e.target.options[e.target.selectedIndex]?.text || ''); }}>
                                                <option value="">城市</option>
                                                {cities.map(([cName, lng]) => <option key={cName} value={lng}>{cName}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className={styles.profileCurrent}>当前数据：{gender === 'female' ? '女' : '男'} · {birthDate} · {cityName || province}</div>
                                    <button className={`${styles.button} ${styles.profileSaveButton}`} onClick={handleGenerate}>保存并重新生成</button>
                                    <div className={styles.privacyNote}>修改出生信息后，人生趋势与年度数据会同步重新计算</div>
                                </div>
                            </div>
                        )}

                        <nav className={styles.dashboardNav} aria-label="数据看板导航">
                            <button className={dashboardTab === 'life' ? styles.dashboardNavActive : ''} onClick={() => { if (!['summary', 'personality'].includes(activeSection)) setActiveSection('summary'); setDashboardTab('life'); window.scrollTo({top: 0, behavior: 'smooth'}); }}>
                                <i className={styles.navLifeIcon} /><span>人生大盘</span>
                            </button>
                            <button className={dashboardTab === 'year' ? styles.dashboardNavActive : ''} onClick={() => { if (['summary', 'personality'].includes(activeSection)) setActiveSection('career'); setDashboardTab('year'); window.scrollTo({top: 0, behavior: 'smooth'}); }}>
                                <i className={styles.navYearIcon} /><span>年度详情</span>
                            </button>
                            <button className={dashboardTab === 'profile' ? styles.dashboardNavActive : ''} onClick={() => { setDashboardTab('profile'); window.scrollTo({top: 0, behavior: 'smooth'}); }}>
                                <i className={styles.navProfileIcon} /><span>个人</span>
                            </button>
                        </nav>
                    </>
                )}
            </div>
            {/* Share overlay */}
            {showShareOverlay && (
                <div
                    className={styles.shareOverlay}
                    onClick={e => {
                        if (e.target === e.currentTarget) {
                            setShowShareOverlay(false);
                        }
                    }}
                >
                    <div className={styles.shareScrollArea}>
                        <canvas ref={shareCanvasRef} className={styles.shareCanvas} />
                    </div>
                    <div className={styles.shareActionBar}>
                        <button className={styles.shareSaveBtn} onClick={saveShareAsImage} disabled={shareSaving}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            {shareSaving ? '生成中…' : '保存图片'}
                        </button>
                        <button className={styles.shareCloseBtn} onClick={() => setShowShareOverlay(false)}>
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

const DestinyChartPage = dynamic(() => Promise.resolve(DestinyChart), {ssr: false});
(DestinyChartPage as any).noLayout = true;
export default DestinyChartPage;
