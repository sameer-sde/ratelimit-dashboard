import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const API_BASE = 'http://localhost:8080';
const POLL_MS = 1000;
const MAX_POINTS = 60;

const ALGO_LABELS = {
  fixed:  'Fixed Window',
  slog:   'Sliding Window Log',
  swc:    'Sliding Window Counter',
  bucket: 'Token Bucket',
};

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const [algorithm, setAlgorithm] = useState('fixed');
  const [requests, setRequests] = useState(1000);
  const [concurrency, setConcurrency] = useState(50);
  const [limit, setLimit] = useState(100);
  const [window_, setWindow_] = useState(60);
  const [capacity, setCapacity] = useState(50);
  const [refill, setRefill] = useState(10);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Key inspector
  const [inspectKey, setInspectKey] = useState('');
  const [inspectData, setInspectData] = useState(null);
  const [inspectError, setInspectError] = useState(null);
  const [watching, setWatching] = useState(false);
  const watchRef = useRef(null);

  useEffect(() => {
    let prevAllowed = 0, prevDenied = 0, firstTick = true;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/metrics`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        setMetrics(data); setError(null);
        if (!firstTick) {
          setHistory(h => [...h, {
            t: new Date().toLocaleTimeString(),
            allowed: Math.max(0, data.allowed - prevAllowed),
            denied:  Math.max(0, data.denied  - prevDenied),
          }].slice(-MAX_POINTS));
        }
        firstTick = false;
        prevAllowed = data.allowed; prevDenied = data.denied;
      } catch (e) { setError(e.message); }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const runLoadTest = async () => {
    setRunning(true); setLastResult(null);
    try {
      const res = await fetch(`${API_BASE}/load-test`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          algorithm, requests: Number(requests), concurrency: Number(concurrency),
          key: `dashboard_loadtest_${algorithm}`,
          limit: Number(limit), window: Number(window_),
          capacity: Number(capacity), refill: Number(refill),
        }),
      });
      setLastResult(await res.json());
    } catch (e) { setLastResult({ error: e.message }); }
    finally { setRunning(false); }
  };

  const fetchInspect = async (key) => {
    if (!key) return;
    try {
      const res = await fetch(`${API_BASE}/inspect/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setInspectData(data); setInspectError(null);
    } catch (e) {
      setInspectError(e.message); setInspectData(null);
    }
  };

  const toggleWatch = () => {
    if (watching) {
      clearInterval(watchRef.current);
      watchRef.current = null;
      setWatching(false);
    } else {
      if (!inspectKey) return;
      fetchInspect(inspectKey);
      watchRef.current = setInterval(() => fetchInspect(inspectKey), 1000);
      setWatching(true);
    }
  };

  // Stop watching if user changes the key
  useEffect(() => {
    if (watching) {
      clearInterval(watchRef.current);
      setWatching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectKey]);

  const perAlgoData = metrics?.per_algorithm
    ? Object.entries(metrics.per_algorithm).map(([alg, s]) => ({
        algorithm: ALGO_LABELS[alg] || alg,
        allowed: s.allowed, denied: s.denied,
      }))
    : [];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>RATELIMIT</div>
        <div style={styles.tagline}>Distributed rate limiter · live dashboard</div>
      </header>

      {error && <div style={styles.error}>⚠ Backend unreachable: {error}</div>}

      <div style={styles.grid}>
        <Kpi label="Total Requests" value={metrics?.total_requests ?? '—'} accent="#60a5fa" />
        <Kpi label="Allowed"        value={metrics?.allowed ?? '—'}        accent="#34d399" />
        <Kpi label="Denied (429)"   value={metrics?.denied ?? '—'}         accent="#f87171" />
        <Kpi label="Cache Hit Rate" value={metrics ? `${metrics.cache_hit_rate.toFixed(1)}%` : '—'} accent="#fbbf24" />
      </div>

      <div style={styles.twoCol}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>LOAD TEST</div>
          <div style={styles.formGrid}>
            <Field label="Algorithm">
              <select value={algorithm} onChange={e=>setAlgorithm(e.target.value)} style={styles.input}>
                <option value="fixed">Fixed Window</option>
                <option value="slog">Sliding Window Log</option>
                <option value="swc">Sliding Window Counter</option>
                <option value="bucket">Token Bucket</option>
              </select>
            </Field>
            <Field label="Requests"><input type="number" value={requests} onChange={e=>setRequests(e.target.value)} style={styles.input} min="1" max="50000" /></Field>
            <Field label="Concurrency"><input type="number" value={concurrency} onChange={e=>setConcurrency(e.target.value)} style={styles.input} min="1" max="200" /></Field>
            {algorithm === 'bucket' ? (
              <>
                <Field label="Capacity"><input type="number" value={capacity} onChange={e=>setCapacity(e.target.value)} style={styles.input} /></Field>
                <Field label="Refill/sec"><input type="number" value={refill} onChange={e=>setRefill(e.target.value)} style={styles.input} step="0.1" /></Field>
              </>
            ) : (
              <>
                <Field label="Limit"><input type="number" value={limit} onChange={e=>setLimit(e.target.value)} style={styles.input} /></Field>
                <Field label="Window (s)"><input type="number" value={window_} onChange={e=>setWindow_(e.target.value)} style={styles.input} /></Field>
              </>
            )}
          </div>
          <button onClick={runLoadTest} disabled={running} style={styles.button}>{running ? 'RUNNING…' : '▶ RUN TEST'}</button>
          {lastResult && (
            <div style={styles.resultBox}>
              {lastResult.error ? (<div style={{color:'#f87171'}}>Error: {lastResult.error}</div>) : (<>
                <ResultRow label="Sent"     value={lastResult.sent} />
                <ResultRow label="Allowed"  value={lastResult.allowed} color="#34d399" />
                <ResultRow label="Denied"   value={lastResult.denied}  color="#f87171" />
                <ResultRow label="Duration" value={`${lastResult.duration_ms} ms`} />
                <ResultRow label="RPS"      value={lastResult.rps.toFixed(0)} color="#fbbf24" big />
              </>)}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>REQUESTS PER SECOND (last 60s)</div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="t" stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6 }} />
              <Line type="monotone" dataKey="allowed" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="denied"  stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KEY INSPECTOR */}
      <div style={{...styles.card, marginTop: 16}}>
        <div style={styles.cardTitle}>KEY INSPECTOR</div>
        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
          <input
            type="text"
            value={inspectKey}
            onChange={e=>setInspectKey(e.target.value)}
            placeholder="e.g. user_42  or  dashboard_loadtest_fixed"
            style={{...styles.input, flex: 1}}
            onKeyDown={e => e.key === 'Enter' && fetchInspect(inspectKey)}
          />
          <button onClick={() => fetchInspect(inspectKey)} style={{...styles.button, width: 120}}>INSPECT</button>
          <button onClick={toggleWatch} style={{...styles.button, width: 140, background: watching ? '#7f1d1d' : '#0e7490'}} disabled={!inspectKey}>
            {watching ? '⏸ STOP WATCH' : '⟳ WATCH'}
          </button>
        </div>
        {inspectError && <div style={styles.error}>⚠ {inspectError}</div>}
        {inspectData && (
          <div style={styles.inspectGrid}>
            <InspectCard title="Fixed Window" data={inspectData.fixed} render={f => (
              <>
                <Row k="Redis Key" v={f.redis_key} mono />
                <Row k="Count" v={f.count} highlight />
                <Row k="TTL" v={`${f.ttl_seconds}s`} />
              </>
            )} />
            <InspectCard title="Sliding Window Log" data={inspectData.slog} render={s => (
              <>
                <Row k="Redis Key" v={s.redis_key} mono />
                <Row k="Count" v={s.count} highlight />
                <Row k="TTL" v={`${s.ttl_seconds}s`} />
                <Row k="Recent" v={`${s.recent?.length || 0} entries`} />
                {s.recent && s.recent.slice(-3).map((e, i) => (
                  <Row key={i} k={`  · req`} v={e.req_id?.slice(0, 24) || '—'} mono small />
                ))}
              </>
            )} />
            <InspectCard title="Sliding Window Counter" data={inspectData.swc} render={s => (
              <>
                {s.current && <Row k={`Cur bucket #${s.current.bucket_id}`} v={s.current.count} highlight />}
                {s.previous && <Row k={`Prev bucket #${s.previous.bucket_id}`} v={s.previous.count} />}
                {!s.current && !s.previous && <Row k="" v="(no active buckets)" />}
              </>
            )} />
            <InspectCard title="Token Bucket" data={inspectData.token_bucket} render={t => (
              <>
                <Row k="Redis Key" v={t.redis_key} mono />
                <Row k="Tokens" v={t.tokens.toFixed(2)} highlight />
                <Row k="TTL" v={`${t.ttl_seconds}s`} />
              </>
            )} />
          </div>
        )}
      </div>

      {perAlgoData.length > 0 && (
        <div style={{...styles.card, marginTop: 16}}>
          <div style={styles.cardTitle}>ALGORITHM COMPARISON</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={perAlgoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="algorithm" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="allowed" stackId="a" fill="#34d399" />
              <Bar dataKey="denied"  stackId="a" fill="#f87171" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.footer}>
        avg RPS since startup: {metrics?.avg_rps?.toFixed(2) ?? '—'} · cache size: {metrics?.cache_size ?? '—'} entries
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (<div style={styles.kpi}><div style={{...styles.kpiLabel, color: accent}}>{label}</div><div style={styles.kpiValue}>{value}</div></div>);
}
function Field({ label, children }) {
  return (<label style={styles.field}><div style={styles.fieldLabel}>{label}</div>{children}</label>);
}
function ResultRow({ label, value, color, big }) {
  return (<div style={styles.resultRow}><span style={styles.resultLabel}>{label}</span><span style={{...styles.resultValue, color: color || '#e5e7eb', fontSize: big ? 22 : 14, fontWeight: big ? 700 : 500}}>{value}</span></div>);
}
function InspectCard({ title, data, render }) {
  return (
    <div style={styles.inspectCard}>
      <div style={styles.inspectTitle}>{title}</div>
      {data ? render(data) : <div style={{fontSize: 12, color: '#6b7280', fontStyle: 'italic'}}>no state</div>}
    </div>
  );
}
function Row({ k, v, mono, highlight, small }) {
  return (
    <div style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: small ? 10 : 12}}>
      <span style={{color: '#9ca3af'}}>{k}</span>
      <span style={{
        color: highlight ? '#fbbf24' : '#e5e7eb',
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
        fontWeight: highlight ? 600 : 400,
        maxWidth: '60%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{v}</span>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0b1220', color: '#e5e7eb', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 32 },
  header: { marginBottom: 24, borderBottom: '1px solid #1f2937', paddingBottom: 16 },
  brand: { fontSize: 24, fontWeight: 800, letterSpacing: 4, color: '#60a5fa' },
  tagline: { fontSize: 12, color: '#9ca3af', marginTop: 4, letterSpacing: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 },
  card: { background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 20 },
  cardTitle: { fontSize: 12, color: '#9ca3af', marginBottom: 16, letterSpacing: 1.5, fontWeight: 600 },
  kpi: { background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 20 },
  kpiLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  kpiValue: { fontSize: 28, fontWeight: 700, color: '#e5e7eb' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  field: { display: 'block' },
  fieldLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  input: { width: '100%', background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6, color: '#e5e7eb', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' },
  button: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '10px', fontSize: 13, fontWeight: 600, letterSpacing: 1, cursor: 'pointer' },
  resultBox: { marginTop: 16, padding: 12, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6 },
  resultRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1f2937' },
  resultLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { fontSize: 14, fontWeight: 500 },
  inspectGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  inspectCard: { background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6, padding: 12 },
  inspectTitle: { fontSize: 11, color: '#60a5fa', letterSpacing: 1, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' },
  footer: { marginTop: 24, fontSize: 11, color: '#6b7280', textAlign: 'center' },
  error: { background: '#7f1d1d', color: '#fecaca', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 },
};
