# Travel Planner API

Express backend for the Travel Planner app. Handles auth (Google/GitHub OAuth + JWT), trips, and locations.

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Install and generate Prisma:
   ```bash
   npm install
   npx prisma generate
   ```
3. Create DB and run migrations (or push schema):
   ```bash
   npx prisma db push
   # or: npx prisma migrate dev
   ```
4. Run:
   ```bash
   npm run dev
   ```
   API runs at `http://localhost:4000`.

## Env

- `PORT` – server port (default 4000)
- `API_URL` – public URL of this API (for OAuth callbacks)
- `FRONTEND_URL` – Next.js app URL (for redirects after login)
- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – secret for signing JWTs
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` – GitHub OAuth
- `GOOGLE_MAPS_API_KEY` – optional, for geocoding

## API

- **Auth**
  - `GET /auth/google` – start Google OAuth
  - `GET /auth/google/callback` – callback (redirects to frontend with `?token=JWT`)
  - `GET /auth/github`, `GET /auth/github/callback` – same for GitHub
  - `POST /auth/logout` – no-op (client clears token)
  - `GET /api/auth/me` – current user (requires `Authorization: Bearer <token>` or `cookie: jwt=...`)

- **Trips** (require auth)
  - `GET /api/trips` – list trips
  - `GET /api/trips/:id` – get trip with locations
  - `POST /api/trips` – create trip (body: `title`, `description`, `startDate`, `endDate`, optional `imageUrl`)
  - `POST /api/trips/:tripId/locations` – add location (body: `address`)

- **Locations** (require auth)
  - `GET /api/locations` – all locations for globe (with county/formattedAddress)
  - `DELETE /api/locations/:id?tripId=...` – delete location
  - `PATCH /api/locations/reorder` – body: `{ tripId, locationIds }`
