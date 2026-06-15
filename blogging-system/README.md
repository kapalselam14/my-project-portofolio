# Personal Blogging Platform

This project is a full-stack blogging platform built around a shared backend API. It includes a `SvelteKit` web frontend for readers and writers, an `Express` backend for application logic and persistence, and a separate `Java Swing` desktop client for admin workflows.

The result is more than a basic CRUD site. It demonstrates multi-client architecture, authentication, relational data design, image handling, and real-time user-facing features in one system.

## What This Project Demonstrates

- Full-stack web application development across frontend, backend, and data layers
- API design that supports both a browser client and a desktop client
- Authentication and protected-route flows with JWT
- Relational data modelling with `SQLite`
- Real-time notification delivery using Server-Sent Events
- Feature development beyond simple posting, including nested comments, likes, and profile management

## Core Features

- User registration, login, and authenticated session flows
- Article creation, editing, deletion, and image upload
- Nested comments and reply threads
- Likes for articles and comments
- Search, sorting, and favourite article views
- Profile and account settings management
- Live notifications without page refresh
- Admin-facing desktop client for user management

## Architecture

The application is structured around a single `Express` API in [`backend/src/`](./backend/src/) that owns the business logic, routing, and database access. The `SvelteKit` frontend in [`frontend/src/`](./frontend/src/) consumes the API for public and authenticated user flows, while the Java admin client in [`java-client/src/`](./java-client/src/) reuses the same backend for administrative operations.

This shared-backend approach is the main architectural strength of the project. It shows that the backend was designed to serve multiple consumers rather than being tightly coupled to a single UI.

## Tech Stack

- Frontend: `SvelteKit`, `Svelte`, `Vite`, `TinyMCE`
- Backend: `Node.js`, `Express`
- Data and persistence: `SQLite`, `sqlite3`
- Auth and validation: `JWT`, `bcrypt`, `yup`
- Media handling: `multer`
- Desktop client: `Java Swing`, `Jackson`

## Repository Layout

```text
blogging-system/
├── backend/
│   └── src/
├── frontend/
│   └── src/
├── java-client/
│   └── src/
├── screenshots/
├── PORTFOLIO_ENTRY.md
└── README.md
```

## Running Locally

From the project root:

```bash
npm install
npm run init
npm run dev
```

Available root scripts:

- `npm run dev` starts backend and frontend together
- `npm run backend` starts the backend only
- `npm run frontend` starts the frontend only
- `npm run init` installs frontend and backend dependencies

Backend scripts are defined in [`backend/package.json`](./backend/package.json), and frontend scripts are defined in [`frontend/package.json`](./frontend/package.json).

## Why It Belongs In A Portfolio

This project is worth showing because it demonstrates more than interface work. It combines API design, authentication, relational storage, live updates, and cross-client reuse in a single codebase. The separate Java admin client is especially useful as a differentiator because it proves the backend can support more than one consumer.

## Related Files

- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) documents the backend routes, auth model, and request formats
- [`PORTFOLIO_ENTRY.md`](./PORTFOLIO_ENTRY.md) contains a longer portfolio planning note for this project
- [`backend/src/sql/init-db.sql`](./backend/src/sql/init-db.sql) shows the relational schema setup
- [`screenshots/`](./screenshots/) can be used for portfolio visuals and demos
