# GrowFriend API Documentation

This document describes the backend API implemented in [`backend/app.js`](./backend/app.js), [`backend/routes/`](./backend/routes/), and the associated controllers in [`backend/controllers/`](./backend/controllers/).

## Base URL

Default local backend:

```text
http://localhost:5000
```

API base:

```text
http://localhost:5000/api
```

## Response Format

Most endpoints use the shared success/error envelope from [`backend/utils/apiResponse.js`](./backend/utils/apiResponse.js):

Successful response:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Bad Request",
  "errors": null
}
```

Implementation note:

- Some controllers return `error.code` objects instead of the generic `errors` field
- The API is mostly consistent, but not perfectly uniform

## Authentication

Protected routes use JWT auth from [`backend/middleware/auth.js`](./backend/middleware/auth.js).

Preferred header:

```http
Authorization: Bearer <jwt>
```

Implementation detail:

- the middleware also accepts a raw JWT string in the `Authorization` header
- admin-only routes require the `ADMIN` role

Common auth failures:

- `401 Missing or invalid Authorization header`
- `401 Invalid or expired token`
- `403 Admin access required`

## Health Endpoints

### `GET /`

Returns a basic API status message.

Example response:

```json
{
  "success": true,
  "message": "GrowFriend API running"
}
```

### `GET /api/health`

Reports Mongo, Redis, cache, and uptime state.

Notes:

- returns `200` when Mongo is ready
- returns `503` when Mongo is not ready

## Auth Routes

Mounted at `/api/auth`.

### `POST /api/auth/register`

Create a new account and starter pet.

Request body:

```json
{
  "name": "Alice",
  "email": "alice@aucklanduni.ac.nz",
  "password": "SecurePass1",
  "securityQuestionCode": "MOTHER_NAME",
  "securityAnswer": "mum",
  "avatar": ""
}
```

Key rules:

- only `@auckland.ac.nz` and `@aucklanduni.ac.nz` emails are accepted
- password must be at least 8 characters
- duplicate email returns `409`
- successful registration grants `30` coins
- registration creates a default starter pet

Success status:

- `201 Created`

### `POST /api/auth/login`

Authenticate a user and return a JWT plus basic user data.

Request body:

```json
{
  "email": "alice@aucklanduni.ac.nz",
  "password": "SecurePass1"
}
```

### `POST /api/auth/forgot/identify`

Look up a user by email or by `User.name` and return the configured security question.

Request body:

```json
{
  "identifier": "alice@aucklanduni.ac.nz"
}
```

Notes:

- if multiple users share the same `name`, the route returns `409` and asks for email instead

### `POST /api/auth/forgot/reset`

Reset a password using `userId`, `email`, and a correct security answer.

Request body:

```json
{
  "userId": "665f...",
  "email": "alice@aucklanduni.ac.nz",
  "securityAnswer": "mum",
  "newPassword": "NewSecurePass1"
}
```

## User Routes

Mounted at `/api/users`.

### `GET /api/users/me`

Return the authenticated user’s profile.

Includes:

- `id`
- `name`
- `email`
- `coins`
- `roles`
- `activePetId`
- `avatar`
- `petName`
- timestamps

### `GET /api/users/me/task-stats`

Return user task summary stats.

Response fields:

- `systemCompleted`
- `p2pCompleted`
- `tasksCreated`

### `PATCH /api/users/me`

Update the current user profile and optionally the active pet nickname.

Accepted fields:

```json
{
  "name": "Alice Updated",
  "username": "Alice Updated",
  "petName": "Sprout",
  "avatar": "https://example.com/avatar.png"
}
```

Notes:

- `name` and `username` are treated as aliases here
- name must be at least 3 characters if provided
- `petName` updates the active pet nickname

### `PATCH /api/users/me/password`

Change the current user password.

Request body:

```json
{
  "currentPassword": "SecurePass1",
  "newPassword": "NewSecurePass1"
}
```

Rules:

- both fields required
- new password must be at least 8 characters

## Dashboard Route

Mounted at `/api/dashboard`.

### `GET /api/dashboard`

Return dashboard summary data for the authenticated user.

Response sections:

- `userSummary`
- `activePetSummary`
- `storeFlags`

Important store flag detail:

- `storeFlags.randomEgg.eggUnlocked` depends on configured unlock logic
- current implementation checks pet stage/level and store affordability in related controllers

## Store Routes

Mounted at `/api/store`.

### `GET /api/store/items`

Return available store items for the current user.

Includes item fields such as:

- `code`
- `name`
- `type`
- `price`
- `growthValue`
- `locked`
- `lockedReason`

Important business rule:

- `RANDOM_EGG` is locked until the user has a fully maxed pet
- current store unlock logic checks for an `ADULT` pet at `level >= 10` with `growthPoints >= 99`

### `POST /api/store/purchase`

Purchase a store item.

Request body:

```json
{
  "itemCode": "APPLE",
  "quantity": 2
}
```

Rules:

- `quantity` defaults to `1`
- `quantity` must be a positive integer
- user must have enough coins
- supported purchasable types are currently `FOOD` and `RANDOM_EGG`

Behavior:

- `FOOD` purchases increase inventory quantity
- `RANDOM_EGG` purchases create new `UserPet` rows in `INVENTORY` state
- purchase writes a coin ledger entry

## Pet Routes

Mounted at `/api/pets`.

### `GET /api/pets/active`

Return the current active pet.

### `GET /api/pets/collection`

Return all non-active pets owned by the user.

### `PATCH /api/pets/active/nickname`

Update the nickname of the active pet.

Request body:

```json
{
  "nickname": "Sparky"
}
```

Rules:

- nickname required
- nickname cannot be blank
- nickname max length is `30`

### `POST /api/pets/:id/feed`

Feed a pet using an inventory item.

Request body:

```json
{
  "itemCode": "APPLE"
}
```

Rules:

- pet must belong to the authenticated user
- item must exist in the user inventory
- only `FOOD` items can be used
- feeding is blocked while `isGrowthFrozen` is true

Behavior:

- decrements inventory quantity
- increases pet growth based on the store item `growthValue`
- may trigger evolution readiness

### `POST /api/pets/:id/evolve`

Evolve a pet to the next stage.

Optional request body:

```json
{
  "speciesId": "665f..."
}
```

Rules:

- `EGG` evolves to `KID` only at level `4`
- `KID` evolves to `ADULT` only at level `9`
- `ADULT` cannot evolve further
- pet must be `evolutionReady`
- `speciesId` is optional during `EGG -> KID` evolution and must be a valid species if provided

### `PATCH /api/pets/:id/activate`

Set one owned pet as the active pet and move the previous active pet into inventory.

## Inventory Route

Mounted at `/api/inventory`.

### `GET /api/inventory`

Return the authenticated user’s inventory.

Each item includes:

- `id`
- `storeItemId`
- `itemCode`
- `itemName`
- `type`
- `price`
- `growthValue`
- `quantity`

## Focus Routes

Mounted at `/api/focus`.

### `POST /api/focus/start`

Start a focus session.

Request body:

```json
{
  "plannedDurationSec": 1500
}
```

Rules:

- defaults to `1500` seconds if omitted
- only one running focus session is allowed at a time

### `GET /api/focus/active`

Return the current running focus session, or `null` if none exists.

### `POST /api/focus/:id/complete`

Complete a focus session and award coins.

Behavior:

- awards `10` coins on first completion
- repeated completion on an already rewarded session returns success without re-awarding

### `POST /api/focus/:id/cancel`

Cancel a focus session.

Behavior:

- sets status to `CANCELLED`
- no coin reward is granted

## Coin Routes

Mounted at `/api/coins`.

### `GET /api/coins/balance`

Return the current coin balance.

Response:

```json
{
  "success": true,
  "message": "Balance loaded",
  "data": {
    "coins": 30
  }
}
```

### `GET /api/coins/history`

Return paginated coin transaction history.

Query params:

- `limit` default `20`, max `100`
- `skip` default `0`
- `type` optional

Valid `type` values:

- `INITIAL_GRANT`
- `FOCUS_REWARD`
- `STORE_PURCHASE`
- `TASK_REWARD`
- `ESCROW_HOLD`
- `ESCROW_RELEASE`
- `ESCROW_PAYOUT`
- `ESCROW_REFUND`
- `ADMIN_ADJUSTMENT`

## Task Routes

Mounted at `/api/tasks`.

The task system supports three task types:

- `PERSONAL`
- `SYSTEM`
- `P2P`

Task status values from the model:

- `OPEN`
- `IN_PROGRESS`
- `PENDING_CONFIRMATION`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`
- `CLOSED`

### `GET /api/tasks`

List tasks.

Query params:

- `type`
- `status`
- `mine=true`
- `category`

Behavior:

- `mine=true` returns tasks created by the user or assigned to them
- without `mine=true`, only public tasks are listed
- public listing defaults to `status=OPEN`
- result set is limited to `50`

### `POST /api/tasks`

Create a task.

Request body:

```json
{
  "type": "P2P",
  "title": "Walk my dog",
  "description": "Need help this afternoon",
  "objectives": ["Arrive on time", "Complete the walk"],
  "timeLimit": 60,
  "rewardCoins": 25,
  "requiresApplication": false,
  "location": "Campus",
  "startAt": "2026-06-15T09:00:00.000Z",
  "category": null
}
```

Rules:

- `type` must be `SYSTEM`, `P2P`, or `PERSONAL`
- only admins can create `SYSTEM` tasks
- `PERSONAL` tasks always have `rewardCoins = 0`
- `PERSONAL` tasks are created as `PRIVATE`
- `P2P` task creation holds escrow coins from the creator immediately
- `SYSTEM` category, when used, must be `organization` or `activity`

### `GET /api/tasks/:id`

Return one task with related assignments and, for creator/admin, applications.

Important visibility rule:

- private tasks are only accessible to their creator
- there is no admin bypass for private task visibility in this controller

### `PATCH /api/tasks/:id`

Update a task.

Editable fields:

- `title`
- `description`
- `objectives`
- `timeLimit`
- `rewardCoins`
- `category`

Rules:

- creator or admin only
- `SYSTEM` tasks are admin-only
- editable only when:
  - `PERSONAL`: `IN_PROGRESS`
  - `P2P` or `SYSTEM`: `OPEN` or `CANCELLED`
- changing `rewardCoins` on an open `P2P` task adjusts escrow

### `DELETE /api/tasks/:id`

Delete a task.

Rules:

- `SYSTEM`: admin only
- `PERSONAL` and `P2P`: creator or admin
- deletable only when status is `OPEN`, `CANCELLED`, or `COMPLETED`
- held `P2P` escrow is refunded before deletion

### `POST /api/tasks/:id/apply`

Apply for or directly take a task.

Behavior depends on task type:

- `SYSTEM` with `requiresApplication=false`: creates an assignment immediately
- `SYSTEM` with `requiresApplication=true`: creates a `PENDING` application
- `P2P`: assigns immediately on first-come-first-served basis and moves task to `IN_PROGRESS`

Important implementation detail:

- although tasks have a `requiresApplication` field, the current `P2P` path does not use it
- in this implementation, `P2P` tasks are taken directly rather than entering an application queue

### `DELETE /api/tasks/:id/apply`

Withdraw a pending application.

Rules:

- only works for existing `PENDING` applications

### `GET /api/tasks/:id/applications`

Return applications for a task.

Allowed caller:

- task creator
- admin

### `PATCH /api/tasks/:id/applications/:appId/decide`

Accept or reject an application.

Request body:

```json
{
  "action": "ACCEPT"
}
```

Rules:

- action must be `ACCEPT` or `REJECT`
- `SYSTEM`: admin decides
- `P2P`: creator or admin decides
- accepting creates an assignment and moves the task to `IN_PROGRESS`

### `DELETE /api/tasks/:id/assignment`

Withdraw a `SYSTEM` task assignment.

Rules:

- only for `SYSTEM` tasks
- only removes the current user’s active assignment

### `POST /api/tasks/:id/submit`

Submit a task as done.

Behavior by task type:

- `PERSONAL`: auto-completes immediately
- `SYSTEM`: auto-completes and pays reward immediately, while task stays `OPEN` for other users
- `P2P`: moves task to `PENDING_CONFIRMATION`

### `POST /api/tasks/:id/confirm`

Confirm a submitted task.

Rules:

- `SYSTEM`: admin only
- `P2P`: creator or admin

Payout behavior:

- `SYSTEM`: creates `TASK_REWARD`
- `P2P`: releases held escrow as `ESCROW_PAYOUT`

### `POST /api/tasks/:id/reject`

Reject a submitted task and return it to active work.

Rules:

- `SYSTEM`: admin only
- `P2P`: creator or admin

Behavior:

- assignment returns to `ASSIGNED`
- task returns to `IN_PROGRESS`

### `POST /api/tasks/:id/cancel`

Cancel a task.

Rules:

- creator or admin
- cannot cancel if already `COMPLETED` or `CANCELLED`

Behavior:

- active `P2P` escrow is refunded if still held

### `POST /api/tasks/:id/reopen`

Re-open a cancelled or expired task.

Rules:

- creator or admin
- `P2P` reopen re-locks escrow using current `rewardCoins`

### `POST /api/tasks/:id/abandon`

Abandon an active `P2P` assignment as the assignee.

Behavior:

- assignment becomes `CANCELLED`
- task becomes `CANCELLED`
- creator escrow is refunded

### `POST /api/tasks/:id/dispute`

Raise a dispute on a `P2P` task.

Request body:

```json
{
  "reason": "Work was incomplete",
  "details": "Optional extra context"
}
```

Rules:

- only for `P2P`
- only while `IN_PROGRESS` or `PENDING_CONFIRMATION`
- only task creator or assignee may raise the dispute

## Admin Routes

Mounted at `/api/admin`.

All routes require:

- authenticated user
- `ADMIN` role

### `GET /api/admin/users`

Return all users without password or security-answer hashes.

### `PATCH /api/admin/users/:id/roles`

Update a user’s role array.

Request body:

```json
{
  "roles": ["USER", "ADMIN"]
}
```

Rules:

- valid roles are `USER` and `ADMIN`
- the array must always include `USER`

### `POST /api/admin/coins/adjust`

Adjust a user’s coin balance.

Request body:

```json
{
  "userId": "665f...",
  "amount": 20,
  "note": "Manual award"
}
```

Rules:

- `amount` must be a non-zero integer
- adjustment cannot push the balance below zero
- writes an `ADMIN_ADJUSTMENT` ledger record

## Suggested Reading In This Repo

- [`backend/app.js`](./backend/app.js)
- [`backend/routes/`](./backend/routes/)
- [`backend/controllers/`](./backend/controllers/)
- [`backend/routes/__test__/`](./backend/routes/__test__/)
