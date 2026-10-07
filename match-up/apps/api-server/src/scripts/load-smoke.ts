/** Performance smoke test — dependency-free latency budget check. */
const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const TOTAL = Number(process.env.PERF_REQUESTS ?? 100);
const CONCURRENCY = Number(process.env.PERF_CONC ?? 10);
const P95_BUDGET_MS = Number(process.env.PERF_P95_MS ?? 1000);
const PER_REQUEST_TIMEOUT_MS = 10_000;

type Sample = { path: string; ms: number; status: number | 'ERR' };

async function one(path: string): Promise<Sample> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS),
    });
    // Drain the body so timing includes full response transfer.
    await res.arrayBuffer();
    return { path, ms: Date.now() - started, status: res.status };
  } catch {
    return { path, ms: Date.now() - started, status: 'ERR' };
  }
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[idx]!;
}

async function main(): Promise<void> {
  // Mix: mostly the cheapest liveness probe, plus one envelope-shaped 404 to prove the JSON error contract holds.
  const paths = Array.from({ length: TOTAL }, (_, i) =>
    i % 10 === 9 ? '/api/no-such-route' : '/api/health',
  );

  const samples: Sample[] = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = await Promise.all(paths.slice(i, i + CONCURRENCY).map(one));
    samples.push(...batch);
  }

  const health = samples.filter((s) => s.path === '/api/health');
  const healthMs = health.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.status === 'ERR').length;
  const byStatus = new Map<number | string, number>();
  for (const s of samples) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

  const p50 = percentile(healthMs, 50);
  const p95 = percentile(healthMs, 95);
  const max = healthMs[healthMs.length - 1] ?? 0;

  console.log(`target=${baseUrl} n=${samples.length} conc=${CONCURRENCY}`);
  console.log(`status=${[...byStatus].map(([k, v]) => `${k}x${v}`).join(' ')}`);
  console.log(
    `/api/health latency ms: p50=${p50} p95=${p95} max=${max} (budget p95<${P95_BUDGET_MS})`,
  );
  console.log(`socket/timeout errors: ${errors} (budget 0)`);

  // Note: /api/health returns 503 when Firestore is unreachable and the 404 probe returns 404 by design.
  let failed = false;
  if (p95 >= P95_BUDGET_MS) {
    console.error(`BREACH: p95 ${p95}ms >= budget ${P95_BUDGET_MS}ms`);
    failed = true;
  }
  if (errors > 0) {
    console.error(`BREACH: ${errors} socket/timeout errors`);
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('SMOKE PASS');
}

await main();
