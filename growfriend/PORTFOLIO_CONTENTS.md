# GrowFriend Portfolio Contents

This file lists what a portfolio repository should contain from this project.

## Include

- `README.md`
  - Replace or trim the current course/team-focused intro with a portfolio-facing summary.
- `backend/`
  - Keep the application code, routes, controllers, middleware, models, utilities, scripts, and tests.
- `frontend/`
  - Keep the application code, pages, components, hooks, context, services, styles, assets, and tests.
- `.gitignore`
  - Keep for clean installs and predictable cloning.
- `Default QTs.png`
  - Useful as a banner or supporting image if you want a quick visual.
- Selected screenshots or gifs
  - Best current candidate: `frontend/src/assets/dashboard_preview_placeholder.gif`
- Deployment references
  - Keep the deployed frontend/backend URLs in the portfolio README if they are still valid.

## Exclude

- Real `.env` files
  - Keep only `.env.example` files.
- `node_modules/`
  - Never commit dependency directories.
- Local-only cache or build outputs
  - Examples: `dist/`, coverage folders, temporary test artifacts.
- Unnecessary course framing
  - Remove or reduce labels like `CS732 project` if the goal is a personal portfolio rather than a course archive.
- Team roster if you want the repo to focus on your own contribution
  - Keep acknowledgements if appropriate, but move detailed team information lower in the README.

## Best Portfolio Shape

If you are building one repository for many projects, this project should appear as one project entry:

```text
projects/
└── growfriend/
    ├── README.md
    ├── backend/
    ├── frontend/
    ├── screenshots/
    └── PORTFOLIO_CONTENTS.md
```

## What This Project Demonstrates

- End-to-end full-stack development
- API and database design
- Authentication and protected routes
- Background product logic beyond CRUD
- Caching and performance awareness
- Automated testing on both frontend and backend
- Deployable project structure
