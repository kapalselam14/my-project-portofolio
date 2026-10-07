# Firebase setup (Realtime Database rules + client config)

Chat realtime works like this:

- **Writes always go through the backend.** The mobile app sends
  `POST /api/chat/messages`; `apps/api-server` checks
  `canAccessActivityChat` (host or participant only) and writes to
  `activityChats/{activityId}/messages/{pushId}` via the Admin SDK.
- **Reads are realtime from the client.** The chat screen subscribes
  to `activityChats/{activityId}/messages` with `firebase_database`
  (`onValue`); when Firebase isn't configured it falls back to
  HTTP polling every 3 seconds.
- **The SDK must be signed in as the real user.** The app
  authenticates via Firebase REST, so after every sign-in / session
  restore it exchanges a backend-minted custom token
  (`POST /api/users/custom-token`) via `RtdbAuthService` and calls
  `FirebaseAuth.signInWithCustomToken`. Without this step the RTDB
  listener is anonymous and gets `permission-denied`.

## 1. Publish the RTDB rules

Rules live in [`database.rules.json`](./database.rules.json). Publish
them from the Firebase console (Realtime Database → Rules) or with
the CLI:

```bash
firebase deploy --only database
```

What they enforce:

- `.read: auth != null` on `activityChats`, `typing`, `presence` —
  any signed-in user can subscribe.
- `.write: false` everywhere except `presence/$uid` — clients can
  never write directly **except** arming their own offline
  `onDisconnect` handler at `presence/{theirUid}` (`auth.uid == $uid`,
  validated to `{state: online|offline, lastChanged: number}`);
  all other writes go through the backend, where membership is checked.
  (The Admin SDK bypasses rules, so backend writes are unaffected.)

Trade-off, stated openly: RTDB rules cannot query Firestore, so
read access is "any authenticated user", not "participants only".
Per-activity authorisation is enforced on every write and on the
`GET messages` history endpoint. Chat content between activity
members is low-sensitivity, so this is acceptable for this project.

## 1b. Publish the Firestore rules (default deny)

Firestore rules live at the repo root ([`firestore.rules`](../../firestore.rules),
wired via [`firebase.json`](../../firebase.json)):

```bash
firebase deploy --only firestore:rules
```

The rule set is a deliberate **default deny for all clients**: no
client SDK in the project touches Firestore directly (mobile uses
RTDB + Storage only, admin web uses HTTPS, seeds use the Admin SDK),
so every Firestore access flows through `apps/api-server`, where
`requireAuth`/`requireAdmin` are enforced in code. This is what makes
suspension unbypassable — `users/{uid}.status` cannot be cleared with
any client token, only via `PATCH /api/admin/members/:uid/status`.

`firestore.get()` lookups inside `storage.rules` are unaffected (rule
evaluation reads ignore these rules).

## 2. Configure the mobile client (`flutterfire configure`)

Realtime chat needs the native Firebase config files, which are
**not** committed (they identify your Firebase project):

```bash
cd apps/mobile
dart pub global activate flutterfire_cli
flutterfire configure
```

This generates `lib/firebase_options.dart` plus
`android/app/google-services.json` and
`ios/Runner/GoogleService-Info.plist`, and sets the Realtime
Database URL. Without these files `Firebase.initializeApp()`
fails at startup and chat silently uses HTTP polling — messages
still send and load, but arrive up to 3 seconds late.

Also set `FIREBASE_DATABASE_URL` in `apps/api-server/.env` (see
`docs/setup/environment-variables.md`) — the backend needs it to
reach the same database.

## 3. Create the Firestore index for profile stats

The profile's Joined count queries the `participants` collection
group by `uid`, which needs a dedicated index. Create it in one
click here (logged in as a project owner):

```text
https://console.firebase.google.com/v1/r/project/matchup-cs734/firestore/indexes?create_exemption=ClNwcm9qZWN0cy9tYXRjaHVwLWNzNzM0L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wYXJ0aWNpcGFudHMvZmllbGRzL3VpZBACGgcKA3VpZBAB
```

or deploy the checked-in definition:

```bash
firebase deploy --only firestore:indexes
```

The definition lives in [`firestore.indexes.json`](./firestore.indexes.json).
Until the index finishes building, profile stats gracefully show
`0` instead of failing; they populate automatically once it is
ready. No code deploy is needed for the switch-over.

## 4. Publish the Storage rules

Photo uploads go through the Firebase SDK, which — unlike the
backend's Admin SDK — must pass security rules. The canonical
rules live at the repo root ([`storage.rules`](../../storage.rules),
wired via [`firebase.json`](../../firebase.json)) and cover:

- `users/{uid}/profile/…` — profile avatars (owner-only write,
  images ≤ 5 MB)
- `activities/{activityId}/cover/…` — activity covers (host-only
  write, images ≤ 8 MB)
- `uploads/chat-attachments/…` — chat photo attachments
  (signed-in write, images ≤ 8 MB)

Publish from the console (**Storage → Rules**) or with:

```bash
firebase deploy --only storage
```

Without this step uploads fail with `permission-denied` (the app
then shows an error snackbar instead of a fake success).
