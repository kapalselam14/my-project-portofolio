# Portfolio Entry: Personal Blogging Platform

## Project Summary

Built a full-stack blogging platform with a `SvelteKit` frontend, `Express` backend, and `SQLite` database, plus a separate `Java Swing` admin client connected to the same API. The platform supports authentication, article publishing, nested comments, likes, profile management, image uploads, and real-time notifications.

## Short Portfolio Description

This project was developed as a multi-client content platform rather than a simple CRUD website. I worked on a system where a web frontend and a desktop administration tool both interact with the same backend API. The result is a more complete application that covers user-facing features, moderation workflows, authentication, persistence, and real-time updates.

## Key Features

- User registration, login, and JWT-based authentication
- Article creation, editing, deletion, and image upload
- Nested comments and reply threads
- Likes for both articles and comments
- User profile and settings management
- Search and article sorting
- Favourite articles view
- Real-time notifications using Server-Sent Events
- Desktop admin client for user management

## Technical Highlights

- Designed a shared backend API used by both the Svelte web app and the Java desktop client
- Implemented JWT-protected routes and role-based admin access
- Used `SQLite` for relational data storage with a schema covering users, articles, comments, likes, notifications, and security questions
- Added Server-Sent Events for live notification delivery without requiring page refresh
- Built persistent frontend auth and theme handling with Svelte stores and browser storage
- Integrated a Java Swing admin client to log in, list users, inspect avatars, and manage user accounts through the same backend

## Architecture

The application is structured around a single `Express` API that owns business logic and data access. The `SvelteKit` frontend consumes the API for public and authenticated user flows, while the `Java Swing` client uses the same endpoints for administrative tasks. `SQLite` is used as the persistent data store, making the project lightweight and easy to run locally while still demonstrating full-stack architecture.

## What Makes This Worth Showing

This is worth keeping in a portfolio because it demonstrates more than frontend page building. It shows full-stack integration, API design, authentication, relational data modeling, real-time communication, and cross-client reuse of backend services. The Java admin client is especially useful as a differentiator because it shows that the backend was designed to support multiple consumers, not just one browser interface.

## Challenges and Tradeoffs

- Real-time notifications required managing authenticated SSE connections and connection lifecycle cleanup
- Keeping frontend auth state consistent across refreshes required central session restoration and global unauthorized-response handling
- The project is strong for local development, but production deployment would need cleanup around hardcoded localhost URLs and environment configuration
- Logout token invalidation is currently stored in memory, which means revocation does not persist across backend restarts

## Tech Stack

- Frontend: `SvelteKit`, `Vite`, `TinyMCE`
- Backend: `Node.js`, `Express`, `SQLite`, `JWT`, `bcrypt`, `multer`, `yup`
- Desktop client: `Java Swing`, `Jackson`

## Resume-Ready Bullet Points

- Built a full-stack blogging platform using `SvelteKit`, `Express`, and `SQLite` with support for authentication, publishing, comments, likes, and user profiles
- Implemented real-time notification delivery using Server-Sent Events and integrated JWT-based protected API flows
- Developed a separate `Java Swing` admin client that reused the same backend API for administrative user management
- Designed and integrated a relational schema for users, articles, comments, likes, images, and notifications in `SQLite`

## What To Include In Your Portfolio Page

- 1 architecture diagram showing frontend, backend, database, and Java admin client
- 3 to 5 screenshots of the main user flows
- 1 short demo video covering login, posting, commenting, notifications, and admin management
- A short note on challenges, tradeoffs, and what you would improve next

## What To Keep In Your Portfolio Repo

Keep the parts that prove the architecture, features, and implementation quality of the project.

- `README.md` rewritten for portfolio audiences
- `frontend/src/` to show the Svelte application structure and UI implementation
- `backend/src/` to show API routes, middleware, database access, and notification logic
- `backend/src/sql/init-db.sql` to show the relational schema
- `java-client/src/` to show the separate admin client and shared-backend design
- `frontend/static/` only for assets that are needed for screenshots or the app UI
- `backend/public/default-avatars/` only if you want demo avatars to remain visible
- 3 to 5 curated screenshots in a separate folder such as `portfolio-assets/`
- This `PORTFOLIO_ENTRY.md` file, or a shortened version of it, as the basis for your public write-up

## What To Remove Before Putting It In A Portfolio Repo

Do not carry over development noise, secrets, or bulky demo data that does not strengthen the project story.

- real `.env` files
- seeded default credentials from public docs
- `node_modules/`, build outputs, and IDE files
- `backend/public/uploads/` user-uploaded content
- `backend/public/temp/` temporary images and sample content
- unused banners, filler images, or assets that do not support your portfolio presentation
- database files created during local runs
- any personal, team-only, or classroom-only notes that are not meant for public viewing

## Suggested Portfolio Repo Structure

```text
portfolio-blog-platform/
|-- README.md
|-- screenshots/
|-- frontend/
|   `-- src/
|-- backend/
|   `-- src/
|-- backend/
|   `-- sql/
`-- java-client/
    `-- src/
```

## Minimum Version To Keep

If you want a lighter portfolio repo, keep only:

- `README.md`
- `frontend/src/`
- `backend/src/`
- `backend/src/sql/init-db.sql`
- `java-client/src/`
- a few screenshots

That is enough to demonstrate the full-stack architecture, major features, and the desktop admin client without carrying all local development artifacts.

## Suggested Screenshot Set

- Home feed
- Article editor modal
- Article detail page with nested comments
- Notification UI
- Java admin dashboard
