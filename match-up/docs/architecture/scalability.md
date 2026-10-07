# Scalability

How MatchUp meets projected demand, and where the current design stops
scaling. Written against the *actual* stack (Express + Firebase), not the
boilerplate-phase overview.

## Architecture (as built)

```
Mobile (Flutter) ──┐
                    ├─ HTTPS/REST ─► Express API (stateless) ─► Firestore (managed)
Admin web (React) ──┘                    │                        ├─ RTDB (managed, realtime reads)
                                         └─ Admin SDK ───────────┘
FCM push ◄── API writes device tokens + Firestore triggers worth notifying
```

- **API is stateless** except for the in-memory rate-limiter map (see Limits).
  No session affinity is required: any instance can serve any request
  because auth state arrives per request as a verifiable Firebase ID token.
- **Data plane is managed Firebase.** Firestore (profiles, activities,
  swipes, reports) and RTDB (chat messages, typing, presence) scale
  horizontally without code changes; the profile-stats collection-group
  query has a checked-in index (`infra/firebase/firestore.indexes.json`).
- **Realtime fan-out is offloaded.** Chat/typing/presence reads stream
  directly client↔RTDB over websockets; the API only performs authorised
  *writes* via the Admin SDK (which bypasses rules). A message therefore
  costs the API one write, regardless of how many subscribers receive it.

## Demand model (course-scale projection)

| Load driver | Assumption | Cost |
|---|---|---|
| Active users (DAU) | 5,000 | — |
| Discover feed loads | 4 / user / day | 20k REST reads/day |
| Chat messages sent | 10 / user / day | 50k RTDB writes/day via API |
| Chat message deliveries | 5 subscribers avg | 250k RTDB fan-out reads/day (no API cost) |
| Typing polls | 2 s interval while a chat is open | bounded by per-route limiter |
| Presence writes | on foreground/background transitions | small, debounced by OS lifecycle |

All figures sit orders of magnitude below Firebase's default quotas and
well within a single Node instance's capacity (~hundreds of req/s for
this JSON-envelope workload; see `npm run perf:smoke`).

## What scales without changes

1. **Read-heavy realtime traffic** — absorbed by RTDB/FCM, not the API.
2. **API throughput** — stateless Express behind N replicas (round-robin);
   Firestore client SDKs multiplex over HTTP/2 with built-in retries.
3. **Abuse dampening** — per-IP fixed-window limiters
   (`middleware/rate-limit.ts`) protect expensive paths (typing polls,
   Nominatim autocomplete proxy) at any replica count.

## Known limits (stated openly)

1. **Rate limiter is per-instance memory by default** (`MemoryRateLimitStore`
   in `middleware/rate-limit.ts`). The counters sit behind the
   `RateLimitStore` interface, so a Redis/Firestore-transaction
   implementation makes limits global without touching the middleware —
   that swap (plus `Retry-After` semantics, already emitted) is the whole
   job. Until then, behind N replicas the effective budget is N×max.
2. **Read cache is partial.** The admin-curated sports list (1 collection
   read + N count queries per call) sits behind `TtlCache` (5 min TTL,
   invalidated on every sport mutation — see `sports.service.ts`). Hot
   per-user reads (`GET /users/me`) still hit Firestore every time; if
   profiles become hot, extend the same `TtlCache` shape to them with a
   short TTL + write-through invalidation.
3. **Single-region RTDB** (`asia-southeast1`). Fine for the target user
   base; multi-region would require Dataflow-style replication that this
   scale does not justify.
4. **Push fan-out is per-device writes** (`deliver-push.service`). Beyond
   ~10k DAU, move to FCM topic fan-out per activity instead of per-token
   sends.

## Scaling runbook (if demand 10×s)

1. Horizontally scale the API (it is already stateless-safe).
2. Swap the limiter store to Redis (interface is already isolated in one
   middleware factory).
3. Add the profile/activity read cache.
4. Move broadcast pushes to FCM topics.
5. Re-run `npm run perf:smoke` against staging with raised budgets.
