# ADR-001 — Communication Protocols

Date: 2026-09-14 · Status: accepted.

## Context

Three clients (Flutter mobile, React admin web, seed scripts) share one
Express API backed by Firestore + RTDB, and the app needs realtime chat,
typing indicators, presence, and push notifications.

## Decision — hybrid, each protocol where it wins

| Channel | Protocol | Used for |
|---|---|---|
| Client → API | **HTTPS REST + JSON envelope** (`{ ok, data }` / `{ ok, error: { code } }`) | all CRUD, auth, admin, moderation, swipes, notifications |
| Client ↔ RTDB | **Firebase RTDB over websockets** (realtime listeners) | chat message streams, typing indicators, presence reads |
| Server → devices | **FCM push** | match/join/message notifications, background + killed states |
| Server → RTDB | **Admin SDK** (bypasses security rules) | all authorised *writes* to chat/typing/presence |
| Server → Nominatim | **HTTPS proxy** (fixed host, rate-limited) | place autocomplete for the venue picker |

## Rationale

1. **REST for state changes** because every mutation needs per-request
   authorisation (membership, host-only, admin-only, suspension) that lives
   in code, plus a uniform error envelope (`RATE_LIMITED`, `ACCOUNT_SUSPENDED`,
   `VALIDATION_ERROR`) that both frontends parse identically. GraphQL was
   rejected: no client needs ad-hoc field selection, and it would have
   duplicated the authorisation layer for no payload saving.
2. **RTDB websockets for fan-out, never for trust.** A chat message costs
   the API exactly one authorised write; delivery to N subscribers is
   Firebase's problem, not ours. Clients can only *read* in realtime
   (`.write: false` + owner-only `presence/$uid`); the one client-side
   write primitive is the presence `onDisconnect` dead-man's switch, whose
   shape is pinned by `.validate` rules.
3. **FCM for anything that must arrive with the app closed.** Polling from
   a killed app is impossible on both OSes; push + deep-link routing
   (`routeForPush`) closes that gap.
4. **Raw sockets (Socket.IO et al.) rejected:** RTDB already provides managed
   fan-out, offline queuing, and `onDisconnect` semantics — rebuilding that
   on self-hosted sockets buys operational burden for zero feature gain.

## Consequences

- Offline/killed behaviour is defined per channel: REST degrades to
  cached UI + error snackbars; RTDB listeners fall back to HTTP polling
  (chat: 3 s) when Firebase is unconfigured; FCM needs platform configs
  that are deliberately gitignored (`flutterfire configure` in
  `infra/firebase/README.md`).
- Rate limiting is split accordingly: REST has global + per-route
  fixed-window limiters; RTDB abuse is bounded by rules + the
  write-through-backend pattern.
- Protocol changes (e.g. topics-based push fan-out past ~10k DAU) are
  tracked in `scalability.md`.
