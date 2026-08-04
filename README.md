# Musafir-Go API

Express backend for **Musafir-Go**, a Muslim-friendly travel planner. Handles authentication, trips, locations, timed activities, expenses & budget, prayer times, nearby mosques/Halal, activity recommendations, and admin reporting.

**Stack:** Express · Prisma 7 · PostgreSQL · Passport (Google/GitHub OAuth) · JWT sessions

## Prerequisites

- Node.js **≥ 20.19**
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- Google Cloud project with **Geocoding API** and **Places API** enabled (for locations, mosques, Halal, recommendations)

## Setup

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```
2. Fill in `.env` (at minimum `DATABASE_URL`, `JWT_SECRET`, and any OAuth/API keys you need).
3. Install dependencies and generate Prisma client:
   ```bash
   npm install
   npm run db:generate
   ```
4. Push schema to the database:
   ```bash
   npm run db:push
   # or for migration-based workflows: npx prisma migrate dev
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
   API runs at `http://localhost:4000` (or your `PORT`).

> **Prisma 7:** `DATABASE_URL` is read from `prisma.config.ts` at the project root, not from `schema.prisma`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Hot-reload dev server (`tsx watch`) |
| `npm run build` | `prisma generate` + TypeScript compile |
| `npm start` | Run compiled `dist/index.js` |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema to DB (no migration files) |
| `npm run db:migrate` | Run migrations (`prisma migrate deploy`) |
| `npm run db:studio` | Open Prisma Studio |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `4000`) |
| `HOST` | No | Bind address (default `0.0.0.0`) |
| `API_URL` | Yes* | Public URL of this API (OAuth callback URLs) |
| `FRONTEND_URL` | Yes* | Next.js app URL (post-login redirects) |
| `CORS_ORIGINS` | No | Comma-separated extra allowed origins |
| `VERCEL_PREVIEW_ORIGIN_REGEX` | No | Regex to allow Vercel preview deploys |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Google OAuth | From Google Cloud Console |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | For GitHub OAuth | From GitHub Developer Settings |
| `GOOGLE_MAPS_API_KEY` | For maps features | Geocoding + Places API |
| `ALADHAN_API_BASE` | No | Prayer times API (default `https://api.aladhan.com/v1`) |
| `ADMIN_EMAILS` | No | Comma-separated emails granted `ADMIN` role (default `admin123@travel.com`) |

\*Required for OAuth and frontend integration in production.

**OAuth setup helper:** `GET /auth/setup` returns the exact callback URLs to register in Google/GitHub consoles.

## Authentication

All `/api/*` routes (except health) require a valid JWT via:

- `Authorization: Bearer <token>` header, or
- `jwt` cookie

### Auth routes (`/auth`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/signup` | Email/password registration |
| `POST` | `/auth/login` | Email/password sign-in |
| `GET` | `/auth/google` | Start Google OAuth |
| `GET` | `/auth/google/callback` | Google callback → redirect to frontend with `?token=JWT` |
| `GET` | `/auth/github` | Start GitHub OAuth |
| `GET` | `/auth/github/callback` | GitHub callback |
| `POST` | `/auth/logout` | Invalidate server session |
| `GET` | `/auth/setup` | Dev helper: OAuth URLs and config status |

### Profile (`/api/auth/me`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user profile + trip stats |
| `PATCH` | `/api/auth/me` | Update `name`, `homeCity`, `timezone`, `image` |
| `POST` | `/api/auth/me/password` | Change password (email accounts only) |

## API reference

### Trips (`/api/trips`) — auth required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips` | List current user's trips |
| `GET` | `/api/trips/:id` | Trip with locations and activities |
| `POST` | `/api/trips` | Create trip (`title`, `description`, `startDate`, `endDate`, optional `imageUrl`) |
| `DELETE` | `/api/trips/:id` | Delete trip (and related locations, activities, expenses, budget) |
| `POST` | `/api/trips/:tripId/locations` | Add location (`address` and/or `latitude`/`longitude`, optional `locationTitle`) |
| `POST` | `/api/trips/:tripId/locations/sync-from-activities` | Sync saved places from activity coordinates |

### Locations (`/api/locations`) — auth required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/locations` | All user locations (for globe view) |
| `DELETE` | `/api/locations/:id?tripId=` | Delete a location |
| `PATCH` | `/api/locations/reorder` | Reorder locations (`{ tripId, locationIds }`) |

### Muslim-friendly features (`/api/trips/:tripId`) — auth required

Requires at least one saved trip location (except recommendations, which uses all locations).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips/:tripId/prayer-times?date=YYYY-MM-DD` | Daily prayer timings (Aladhan) |
| `GET` | `/api/trips/:tripId/nearby/mosques?radius=5000&latitude=&longitude=` | Nearby mosques (optional coords override trip center) |
| `GET` | `/api/trips/:tripId/nearby/halal?radius=5000` | Nearby Halal restaurants |
| `GET` | `/api/trips/:tripId/activity-recommendations?radius=5000&exclude=&extended=` | Activity suggestions near each saved location |

### Activities (`/api/trips/:tripId/activities`) — auth required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips/:tripId/activities` | List activities |
| `POST` | `/api/trips/:tripId/activities` | Create timed activity (auto-syncs trip location when possible) |
| `GET` | `/api/trips/:tripId/activities/travel-times?date=&mode=driving\|transit\|walking&order=` | Smart travel estimates between consecutive stops |
| `PATCH` | `/api/trips/:tripId/activities/:activityId` | Update activity |
| `DELETE` | `/api/trips/:tripId/activities/:activityId` | Delete activity |

### Expenses (`/api/trips/:tripId/expenses`) — auth required

Categories: `TRANSPORT`, `ACCOMMODATION`, `FOOD`, `ACTIVITIES`, `SHOPPING`, `OTHER`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips/:tripId/expenses` | List expenses |
| `POST` | `/api/trips/:tripId/expenses` | Create expense (optional `activityId` link) |
| `PATCH` | `/api/trips/:tripId/expenses/:expenseId` | Update expense |
| `DELETE` | `/api/trips/:tripId/expenses/:expenseId` | Delete expense |

### Budget (`/api/trips/:tripId/budget`) — auth required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips/:tripId/budget` | Get trip budget |
| `PUT` | `/api/trips/:tripId/budget` | Upsert total and/or per-category budgets |
| `DELETE` | `/api/trips/:tripId/budget` | Clear budget |

### Places (`/api/places`) — auth required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/places/search?input=` | Google Places autocomplete for activity/location forms |

### Admin (`/api/admin`) — `ADMIN` role required

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/summary` | Counts: users, trips, locations, activities, active sessions |
| `GET` | `/api/admin/users` | All users |
| `GET` | `/api/admin/trips` | Recent trips |
| `GET` | `/api/admin/locations` | Recent locations |
| `GET` | `/api/admin/prayer-facilities` | Mosques near recent user locations |
| `GET` | `/api/admin/halal-restaurants` | Halal restaurants near recent locations |
| `GET` | `/api/admin/settings` | Integration and OAuth config status |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ ok: true }` |

## Project structure

```
src/
├── app.ts              # Express app + route mounting
├── index.ts            # Server entry
├── config/passport.ts  # OAuth strategies
├── middleware/auth.ts  # JWT + session + admin guard
├── routes/             # Route handlers
├── services/           # aladhan, geocode, places, distance-matrix, password
└── lib/                # prisma, trip-utils
prisma/
└── schema.prisma       # Database models
```

## Related repos

- **Frontend:** [../travel-planner-web](../travel-planner-web) — Musafir-Go Next.js UI
- **Plan:** [../PROJECT_PLAN.md](../PROJECT_PLAN.md) — development timeline and module checklist
