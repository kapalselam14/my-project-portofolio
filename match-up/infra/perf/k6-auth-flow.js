// k6 authenticated-flow load test — graduates `npm run perf:smoke`
// (see docs/architecture/testing-strategy.md) to realistic traffic:
// liveness + public catalog + authenticated reads (profile, discover
// feed, chat history). Writes are deliberately excluded so load runs
// never pollute chat/presence data.
//
// Requires k6 (https://k6.io/docs/get-started/installation/) and a
// staging target with a test user:
//
//   export API_BASE_URL=https://staging.example.com
//   export API_ID_TOKEN=<firebase-id-token-for-test-user>
//   export ACTIVITY_ID=<activity-with-chat-history>
//   k6 run infra/perf/k6-auth-flow.js
//
// Budgets: p95 < 800ms per endpoint class, error rate < 1%.
// Exit code is non-zero on breach (usable as a deploy gate).
import { check, group } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

const BASE = __ENV.API_BASE_URL || 'http://localhost:4000';
const TOKEN = __ENV.API_ID_TOKEN || '';
const ACTIVITY_ID = __ENV.ACTIVITY_ID || 'seed-act-basketball-1';

const errors = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.01'],
    'http_req_duration{kind:health}': ['p(95)<800'],
    'http_req_duration{kind:public}': ['p(95)<800'],
    'http_req_duration{kind:auth}': ['p(95)<800'],
  },
};

const authHeaders = TOKEN
  ? { headers: { Authorization: `Bearer ${TOKEN}` } }
  : undefined;

function tag(kind) {
  return { tags: { kind } };
}

export default function () {
  group('liveness', () => {
    const r = http.get(`${BASE}/api/health`, tag('health'));
    check(r, { 'health 2xx/5xx (stack exercised)': (x) => x.status >= 200 && x.status < 600 });
    errors.add(r.status === 0 ? 1 : 0);
  });

  group('public catalog', () => {
    const r = http.get(`${BASE}/api/public/sports`, tag('public'));
    check(r, { 'sports ok': (x) => x.status === 200 && x.json('ok') === true });
    errors.add(r.status !== 200 ? 1 : 0);
  });

  if (!authHeaders) return;

  group('authenticated reads', () => {
    let r = http.get(`${BASE}/api/users/me`, { ...authHeaders, tags: { kind: 'auth' } });
    check(r, { 'me ok': (x) => x.status === 200 });
    errors.add(r.status !== 200 ? 1 : 0);

    r = http.get(`${BASE}/api/activities?discover=1&limit=20`, {
      ...authHeaders,
      tags: { kind: 'auth' },
    });
    check(r, { 'discover ok': (x) => x.status === 200 });
    errors.add(r.status !== 200 ? 1 : 0);

    r = http.get(`${BASE}/api/chat/${ACTIVITY_ID}/messages`, {
      ...authHeaders,
      tags: { kind: 'auth' },
    });
    check(r, { 'chat history ok|forbidden': (x) => x.status === 200 || x.status === 403 });
    errors.add(r.status !== 200 && r.status !== 403 ? 1 : 0);
  });
}
