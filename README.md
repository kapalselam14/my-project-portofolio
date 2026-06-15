# Project Portfolio

Welcome to my portfolio repository. This repo collects selected software projects that I use to demonstrate how I approach product design, full-stack engineering, architecture, and implementation quality across different stacks.

The projects here are not just screenshots or static demos. Each folder contains real application code, project structure, and supporting documentation so visitors can inspect how the work was built.

## What You Will Find Here

- Full-stack applications with separate frontend and backend layers
- Projects that show API design, authentication, persistence, and testing
- Different client experiences across web and desktop environments
- Project-specific README files with more technical detail

## Featured Projects

### 1. GrowFriend

[`growfriend/`](./growfriend/) is a gamified productivity application where users complete tasks, run focus sessions, earn in-app rewards, and raise virtual pets.

**Highlights**

- Full-stack product with `React`, `Vite`, `Node.js`, and `Express`
- `MongoDB` and `Redis` integration for persistence and caching
- JWT-based authentication and protected application flows
- Pomodoro focus mode, task economy, and pet progression system
- Automated tests across backend models/routes and frontend utilities/components

This project is useful for showing end-to-end product thinking, application state management, backend architecture, and feature development beyond basic CRUD.

### 2. Personal Blogging Platform

[`blogging-system/`](./blogging-system/) is a multi-client blogging platform built around a shared backend API. It includes a web frontend for readers and writers, plus a separate Java desktop client for administration.

**Highlights**

- `SvelteKit` frontend with an `Express` backend
- `SQLite` relational storage with authentication and content workflows
- Article publishing, nested comments, likes, profile management, and image uploads
- Real-time notifications using Server-Sent Events
- Separate `Java Swing` admin client using the same backend API

This project is useful for showing API reuse across multiple clients, relational data design, authentication flows, and full-stack integration.

## Tech Across This Portfolio

- Frontend: `React`, `SvelteKit`, `Vite`
- Backend: `Node.js`, `Express`
- Data: `MongoDB`, `Mongoose`, `Redis`, `SQLite`
- Auth and security: `JWT`, `bcrypt`
- Testing: `Vitest`, `Supertest`
- Desktop client: `Java Swing`

## Repository Structure

```text
my-project-portofolio/
├── README.md
├── blogging-system/
│   ├── backend/
│   ├── frontend/
│   ├── java-client/
│   ├── screenshots/
│   ├── PORTFOLIO_ENTRY.md
│   ├── README.md
│   └── package.json
└── growfriend/
    ├── backend/
    ├── frontend/
    ├── screenshots/
    ├── Default QTs.png
    ├── PORTFOLIO_CONTENTS.md
    ├── README.md
    └── package.json
```

## How To Explore

If you are reviewing this repository for technical depth, the best path is:

1. Start with the project summary in each folder.
2. Inspect the frontend and backend source structure.
3. Review the routes, controllers, models, and utilities to understand architecture decisions.
4. Check the tests to see how behavior is validated.

## Notes

- `growfriend/README.md` currently contains the stronger project-level overview.
- `blogging-system/PORTFOLIO_ENTRY.md` is currently the more useful project summary than `blogging-system/README.md`.
- This root README is intended as a quick introduction for portfolio visitors.
- Some projects may still contain coursework-era structure, but they are included here because they demonstrate real engineering work and architectural decisions.
