# Aerostasis

A 3D management game about running a private jet FBO (fixed-base operator) at the General Aviation Terminal, Murtala Muhammed International Airport, Lagos. Players land, tow, service and launch business jets, run the business side (pricing, fuel buying, staff, safety and IS-BAH certification), and learn aviation management through case studies, a glossary and weekly quizzes.

## How it is built

| Part | Where it lives | What it does |
|---|---|---|
| Game | `public/index.html` | A single page: three.js scene, game logic and interface |
| API | `functions/api/*` | Cloudflare Pages Functions: Google sign-in, sessions, leaderboard, cloud saves |
| Database | Cloudflare D1 `aerostasis` | Tables `users`, `sessions`, `scores`, `saves` (see `schema.sql`) |
| Config | `wrangler.toml` | Build output folder, Google client ID and the D1 binding |

Players can play as guests (progress stays in the browser) or sign in with Google to appear on the global leaderboard and keep their company in the cloud.

### API

| Method and path | Purpose |
|---|---|
| `GET /api/config` | Public settings for the client (Google client ID) |
| `POST /api/auth/google` | Exchanges a Google ID token for a session cookie |
| `POST /api/auth/logout` | Ends the session |
| `GET /api/me`, `PATCH /api/me` | The signed-in player; change the leaderboard name |
| `GET /api/scores`, `POST /api/scores` | Top 50 plus your rank; post a run (only your best run is kept) |
| `GET/PUT/DELETE /api/save` | Cloud save for the signed-in player |

Sessions are random tokens stored hashed in D1 and sent as `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Write requests from other sites are refused. Because the game runs in the browser, score checks limit obvious tampering but cannot prevent a determined cheat; treat the leaderboard as a friendly competition.

## Deployment

Every push to `main` deploys automatically through Cloudflare Pages.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and choose this repository.
2. Build settings: framework preset **None**, build command empty, build output directory `public`.
3. The D1 binding and variables are read from `wrangler.toml`.
4. In Google Cloud Console, add the Pages address (and any custom domain) to the OAuth client's **Authorised JavaScript origins**.

## Local development

```bash
npm install
npm run db:init:local
npm run dev            # http://localhost:8788
```

Google sign-in only works on origins registered with the OAuth client, so add `http://localhost:8788` to the client's authorised origins if you want to test sign-in locally.
