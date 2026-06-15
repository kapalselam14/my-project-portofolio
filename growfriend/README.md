# GrowFriend

GrowFriend is a full-stack productivity application that turns task completion into a pet-raising game. Users manage personal tasks, participate in system and peer-to-peer tasks, run Pomodoro focus sessions, and earn in-app currency used to grow virtual pets.

## Why It Belongs In A Portfolio

- It is a complete frontend and backend project rather than an isolated feature.
- It combines application logic, persistence, authentication, caching, deployment, and automated testing.
- It has a clear product story: gamified productivity with pet progression, task economy, and focus sessions.

## Stack

- Frontend: React, Vite, Framer Motion, React Router
- Backend: Node.js, Express
- Data: MongoDB, Mongoose, Redis
- Auth: JWT, bcrypt
- Testing: Vitest, Supertest, mongodb-memory-server

## Portfolio Highlights

- Gamified pet growth system with staged evolution.
- Multi-mode task system: personal, system, and peer-to-peer.
- Escrow-backed task flow for peer-to-peer rewards and disputes.
- Pomodoro-style focus mode connected to in-app rewards.
- Redis-backed caching for selected read-heavy endpoints.
- Automated tests across models, routes, hooks, utilities, and UI components.

## Recommended Positioning

If this goes into a personal portfolio repo, present it as:

- A team-built full-stack application.
- Your contribution should be called out explicitly in the portfolio repo root or this project README.
- The course/team branding in the original root README can be reduced so the portfolio version focuses on the product, the architecture, and your role.

## Recommended Demo Assets

These existing files are useful as lightweight portfolio visuals:

- `Default QTs.png`
- `frontend/src/assets/dashboard_preview_placeholder.gif`
- `frontend/src/assets/team-logo1.png`

## Source Layout To Keep

```text
growfriend/
├── README.md
├── PORTFOLIO_CONTENTS.md
├── backend/
├── frontend/
└── screenshots/
```

The application code already has a good separation between frontend and backend, so it is suitable to keep as a self-contained project folder inside a larger portfolio repository.
