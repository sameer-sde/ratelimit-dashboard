# Rate Limiter Dashboard

React + Vite dashboard for the
[ratelimit](https://github.com/sameer-sde/ratelimit) backend. Provides:

- **Live KPI cards** — Total / Allowed / Denied / Cache Hit Rate
- **Real-time chart** — requests per second, polled every 1s
- **Load Tester** — run controlled load against any of the four
  algorithms from the browser
- **Algorithm Comparison** — stacked bar chart of allows vs denies
  per algorithm
- **Key Inspector** — raw Redis state for any key across all four
  algorithms, with live watch mode

## Running

The dashboard expects the backend at `http://localhost:8080`.

```bash
# Start the backend first (in the ratelimit repo)
docker compose up -d
go run ./cmd/server

# Then the dashboard
npm install
npm run dev
```

Dashboard opens on `http://localhost:5180`.

## Stack

- React 18 + Vite (HMR)
- Recharts for the time-series chart
- Vanilla CSS, dark theme
- 1s polling against `/metrics`

## Backend

See [sameer-sde/ratelimit](https://github.com/sameer-sde/ratelimit) for
the Go server, four algorithms, hash ring, LRU cache, and benchmarks.

---

Built as part of a learning project — distributed rate limiting in Go,
benchmarked to 18,769 req/s at p95 16ms.
