# API Documentation

This document describes the backend API implemented in [`backend/src/routes/`](./backend/src/routes/).

## Base URL

Local backend default:

```text
http://localhost:3000
```

API root:

```text
http://localhost:3000/api
```

Important implementation detail:

- Auth routes are mounted directly under `/api`
- They are not mounted under `/api/auth`
- Some inline code comments still mention `/api/auth/...`, but the actual routes in this repo use `/api/...`

## Authentication

Authenticated endpoints expect:

```http
Authorization: Bearer <jwt>
```

Authentication behavior is implemented in [`backend/src/middleware/auth-middleware.js`](./backend/src/middleware/auth-middleware.js).

Common auth failures:

- `401 Authentication required` when the `Authorization` header is missing
- `401 Invalid token` when the JWT is invalid
- `401 Token expired` when the JWT has expired
- `401 Token revoked` after logout
- `403 Forbidden` when the user is authenticated but lacks permission

## Response Style

The API is not fully uniform. Some endpoints return plain arrays or objects, while others return wrapper objects such as:

```json
{
  "message": "Success message",
  "data": {}
}
```

This documentation follows the implementation as it exists in the repo.

## File Uploads

### Avatar uploads

- Content type: `multipart/form-data`
- Field name: `avatar`
- Allowed types: `image/jpeg`, `image/jpg`, `image/png`
- Size limit: `5 MB`

### Article image uploads

- Content type: `multipart/form-data`
- Field names:
  - `headerImage` with max count `1`
  - `images` with max count `25`
- Size limit: `10 MB` per file

## Endpoints

### Health and API root

#### `GET /`

Returns a simple backend health message.

Response:

```json
{ "message": "Hello, world!" }
```

#### `GET /api`

Returns the API root message.

Response:

```json
{ "message": "Welcome to the API root!" }
```

## Auth

### `POST /api/login`

Authenticate a user and return a JWT plus user data.

Request body:

```json
{
  "username": "alice",
  "password": "StrongPass1!"
}
```

Success response:

```json
{
  "message": "Welcome back, alice!",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "alice"
  }
}
```

### `POST /api/logout`

Blacklist the current JWT and end the session.

Auth required: yes

Success response:

- `204 No Content`

### `GET /api/logout`

Alternate logout route with the same behavior as `POST /api/logout`.

Auth required: yes

Success response:

- `204 No Content`

### `POST /api/register`

Create a new user account.

Content type:

- `multipart/form-data` when uploading an avatar
- otherwise JSON is accepted by the route logic plus Express JSON parsing

Fields:

- `username`
- `password`
- `confirmPassword`
- `real_name`
- `date_of_birth` in `YYYY-MM-DD`
- `description` optional
- `avatar_url` optional
- `security_question_id`
- `security_answer`
- `avatar` optional uploaded image file

Success response:

- `201 Created`
- `Location: /api/users/:id`

### `GET /api/security-questions`

Return all security questions for registration and password recovery.

Response:

```json
[
  { "id": 1, "question": "..." }
]
```

### `GET /api/check-username?username=<value>`

Check whether a username is available.

Response:

```json
{ "available": true }
```

### `POST /api/create-admin`

Create an admin user.

This route is publicly mounted in the current implementation, so treat it as development-only unless additional protection is added.

Request body:

Same shape as `POST /api/register`.

### `POST /api/forgot-password/question`

Look up the configured security question for a username.

Request body:

```json
{ "username": "alice" }
```

Response:

```json
{
  "username": "alice",
  "security_question_id": 1,
  "question": "..."
}
```

### `POST /api/forgot-password/reset`

Verify the security answer and reset the password.

Request body:

```json
{
  "username": "alice",
  "security_answer": "example",
  "new_password": "NewStrongPass1!",
  "confirm_password": "NewStrongPass1!"
}
```

## Users

### `GET /api/users/avatars`

Return the built-in avatar choices.

Public: yes

### `GET /api/users/top-authors?limit=3`

Return top authors ranked by likes.

Public: yes

Query params:

- `limit` optional, default `3`

### `GET /api/users`

Return all users.

Auth required: yes

Admin required: yes

Supported query params are passed through to the DAO for filtering:

- `username`
- `real_name`
- `date_of_birth`
- `description`
- `avatar_url`
- `is_admin`
- `is_active`

### `GET /api/users/:id/public`

Return the public profile view for a user.

Public: yes

### `GET /api/users/:id/stats`

Return public stats for a user, including top article data.

Public: yes

### `GET /api/users/:id`

Return a full user record.

Auth required: yes

Allowed caller:

- the user themselves
- an admin

### `PUT /api/users/:id`

Update a user profile.

Auth required: yes

Allowed caller:

- the user themselves
- an admin

Request body fields are optional:

```json
{
  "username": "alice.updated",
  "real_name": "Alice Example",
  "date_of_birth": "2000-01-01",
  "description": "Updated bio",
  "avatar_url": "/users-avatars/example.png"
}
```

### `PUT /api/users/:id/password`

Change a user password.

Auth required: yes

Allowed caller:

- the user themselves
- an admin

Request body:

```json
{
  "oldPassword": "OldPass1!",
  "newPassword": "NewPass1!"
}
```

### `DELETE /api/users/:id`

Delete a user.

Auth required: yes

Modes:

- soft delete: any authenticated self-delete flow can use `?mode=soft`
- hard delete: requires admin privileges, and is the default if `mode` is not supplied

Examples:

```text
DELETE /api/users/5?mode=soft
DELETE /api/users/5?mode=hard
```

Important implementation detail:

- The route currently defaults to `hard` delete when no `mode` is supplied
- Hard delete is blocked for non-admin users

### `POST /api/users/:id/avatar`

Upload a custom avatar and update the user profile.

Auth required: yes

Allowed caller:

- the user themselves
- an admin

Content type:

- `multipart/form-data`

Field:

- `avatar`

## Articles

### `POST /api/articles/upload-images`

Upload article media without creating the article yet.

Auth required: yes

Content type:

- `multipart/form-data`

Fields:

- `headerImage` optional
- `images` optional list

Response:

```json
{
  "headerImageUrl": "/uploads/example.jpg",
  "embeddedImageUrls": ["/uploads/example-2.jpg"]
}
```

### `POST /api/articles`

Create a new article.

Auth required: yes

Content type:

- `multipart/form-data`

Fields:

- `title`
- `content`
- `headerImage` optional
- `images` optional list

Success response:

- `201 Created`
- `Location: /api/articles/:articleId`

### `GET /api/articles`

List articles with optional filtering and sorting.

Public: yes

Query params:

- `search`
- `authorId`
- `sortBy` one of `title`, `username`, `date`
- `sortOrder` one of `asc`, `desc`

Implementation note:

- invalid `sortBy` falls back to `date`
- invalid `sortOrder` falls back to `desc`

### `GET /api/articles/author/:authorId/count`

Return article count for a specific author.

Public: yes

### `GET /api/articles/:articleId`

Return one article plus its linked images.

Public: yes

Response shape:

```json
{
  "message": "Requested article with ID: 10",
  "article": {},
  "images": []
}
```

### `GET /api/articles/liked/:userId`

Return liked articles for a user.

Auth required: yes

Note:

- The current implementation requires authentication
- It does not explicitly enforce that `:userId` matches the authenticated user

### `PUT /api/articles/:articleId`

Update an article.

Auth required: yes

Allowed caller:

- the article author
- an admin

### `DELETE /api/articles/:articleId`

Delete an article.

Auth required: yes

Allowed caller:

- the article author
- an admin

Modes:

- soft delete by default
- hard delete with `?hard=1` or `?hard=true`

## Article comments

### `GET /api/articles/:articleId/comments`

Return all comments for an article.

Public: yes

### `POST /api/articles/:articleId/comments`

Create a comment on an article.

Auth required: yes

Request body:

```json
{
  "content": "Nice post",
  "parent_comment_id": null
}
```

Notes:

- use `parent_comment_id` to create a reply
- this route also triggers notification logic for article comments and replies

### `GET /api/articles/:articleId/comments/:commentId`

Return a single comment.

Public: yes

### `PATCH /api/articles/:articleId/comments/:commentId`

Update a comment.

Auth required: yes

Allowed caller:

- the comment author only

Request body:

```json
{
  "content": "Updated comment"
}
```

### `DELETE /api/articles/:articleId/comments/:commentId`

Delete a comment.

Auth required: yes

Allowed caller:

- the comment author
- the article author
- an admin

Modes:

- soft delete by default
- hard delete with `?hard=1` or `?hard=true`

## Article likes

### `GET /api/articles/:articleId/likes/count`

Return public like count for an article.

Public: yes

### `GET /api/articles/:articleId/likes`

Return whether the current user has liked the article plus the current like count.

Auth required: yes

Response:

```json
{
  "liked": true,
  "likesCount": 7
}
```

### `POST /api/articles/:articleId/likes`

Like an article.

Auth required: yes

Notes:

- duplicate likes return `200` with an informational message
- the route also emits an article-like notification when applicable

### `DELETE /api/articles/:articleId/likes`

Unlike an article.

Auth required: yes

Behavior:

- performs a soft remove to preserve like history for notification logic

## Article images

### `GET /api/articles/:articleId/images`

Return linked images for an article.

Public: yes

### `POST /api/articles/:articleId/images`

Link an already uploaded image URL to an article.

Auth required: yes

Allowed caller:

- the article author
- an admin

Request body:

```json
{
  "url": "/uploads/example.jpg"
}
```

### `DELETE /api/articles/:articleId/images/:imageId`

Delete a linked image from an article.

Auth required: yes

Allowed caller:

- the article author
- an admin

## Comment-level routes

These routes are mounted separately from article-scoped comment routes.

### `PUT /api/comments/:commentId`

Update a comment.

Auth required: yes

Important implementation note:

- this route uses `requireSelfOrAdmin`, which checks `req.params.id`
- the route param here is `commentId`, not `id`
- as implemented, this middleware pairing is inconsistent and should be treated carefully

### `DELETE /api/comments/:commentId`

Delete a comment.

Auth required: yes

Important implementation note:

- the same middleware mismatch applies here as in `PUT /api/comments/:commentId`

## Comment likes

### `GET /api/comments/:commentId/likes`

Return whether the current user has liked the comment plus the current like count.

Auth required: yes

### `POST /api/comments/:commentId/likes`

Like a comment.

Auth required: yes

Notes:

- duplicate likes return `200`
- re-liking a previously soft-removed like reactivates it
- this route also creates a comment-like notification

### `DELETE /api/comments/:commentId/likes`

Unlike a comment.

Auth required: yes

Behavior:

- performs a soft remove to preserve history

## Notifications

### `GET /api/notifications`

Return the current user’s notifications plus unread count.

Auth required: yes

Query params:

- `limit` default `20`
- `offset` default `0`
- `unreadOnly=true|false`

Response shape:

```json
{
  "notifications": [],
  "unreadCount": 3
}
```

### `POST /api/notifications/mark-read`

Mark selected notifications as read.

Auth required: yes

Request body:

```json
{
  "ids": [1, 2, 3]
}
```

### `POST /api/notifications/mark-all-read`

Mark all notifications as read for the current user.

Auth required: yes

### `GET /api/notifications/stream`

Open a Server-Sent Events stream for live notification updates.

Auth:

- accepts `Authorization: Bearer <jwt>`
- or `?token=<jwt>` in the query string

Response content type:

```text
text/event-stream
```

Notes:

- sends an initial event containing unread count
- sends keepalive pings roughly every 25 seconds
- unregisters the connection on close or abort

## Suggested Reading In This Repo

- [`backend/src/routes/api/`](./backend/src/routes/api/)
- [`backend/src/middleware/auth-middleware.js`](./backend/src/middleware/auth-middleware.js)
- [`backend/src/data/`](./backend/src/data/)
