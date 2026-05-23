import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:8080';
const POLL_MS = 1000;
const MAX_POINTS = 60; // last 60 seconds

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let prevTotal = 0;
    let prevAllowed = 0;
    let prevDenied = 0;
    let firstTick = true;

    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/metrics`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        setMetrics(data);
        setError(null);

        if (!firstTick) {
          const dAllowed = Math.max(0, data.allowed - prevAllowed);
          const dDenied = Math.max(0, data.denied - prevDenied);
          const point = {
            t: new Date().toLocaleTimeString(),
            allowed: dAllowed,
            denied: dDenied,
          };
          setHistory(h => [...h, point].slice(-MAX_POINTS));
        }
        firstTick = false;

        prevTotal = data.total_requests;
        prevAllowed = data.allowed;
        prevDenied = data.denied;
      } catch (e) {
        setError(e.message);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>RATELIMIT</div>
        <div style={styles.tagline}>Distributed rate limiter · live dashboard</div>
      </header>

      {error && <div style={styles.error}>⚠ Backend unreachable: {error}</div>}

      <div style={styles.grid}>
        <Kpi label="Total Requests" value={metrics?.total_requests ?? '—'} accent="#60a5fa" />
        <Kpi label="Allowed" value={metrics?.allowed ?? '—'} accent="#34d399" />
        <Kpi label="Denied (429)" value={metrics?.denied ?? '—'} accent="#f87171" />
        <Kpi
          label="Cache Hit Rate"
          value={metrics ? `${metrics.cache_hit_rate.toFixed(1)}%` : '—'}
          accent="#fbbf24"
        />
      </div>

      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Requests per second (last 60s)</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="t" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Line type="monotone" dataKey="allowed" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="denied" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.footer}>
        avg RPS since startup: {metrics?.avg_rps?.toFixed(2) ?? '—'} · cache size: {metrics?.cache_size ?? '—'} entries
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={styles.kpi}>
      <div style={{ ...styles.kpiLabel, color: accent }}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b1220',
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: 32,
  },
  header: {
    marginBottom: 32,
    borderBottom: '1px solid #1f2937',
    paddingBottom: 16,
  },
  brand: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: 4,
    color: '#60a5fa',
  },
  tagline: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    letterSpacing: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  kpi: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 8,
    padding: 20,
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e5e7eb',
  },
  chartCard: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 8,
    padding: 20,
  },
  chartTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 24,
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    background: '#7f1d1d',
    color: '#fecaca',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  },
};
