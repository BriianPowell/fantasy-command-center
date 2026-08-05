# Yahoo Sports Backend Path

Yahoo Sports requires OAuth credentials and refresh tokens, so it should not be called directly from the GitHub Pages app.

## Backend Responsibilities

- Own Yahoo OAuth sign-in, callback handling, token refresh, and logout.
- Store client ID, client secret, and refresh tokens outside the browser.
- Expose normalized JSON responses that match the frontend domain models in `src/domain/types.ts`.
- Set secure HTTP-only cookies for browser sessions.
- Allow the static frontend origin in CORS.

## Proposed Endpoints

- `GET /api/yahoo/auth/start`: redirect the user to Yahoo OAuth.
- `GET /api/yahoo/auth/callback`: exchange the OAuth code and create a session.
- `POST /api/yahoo/auth/logout`: clear the session cookie.
- `GET /api/yahoo/leagues?query=&season=`: list matching leagues.
- `GET /api/yahoo/leagues/:leagueId`: return a normalized `League`.
- `GET /api/yahoo/leagues/:leagueId/normalized`: return `NormalizedLeagueData`.
- `GET /api/yahoo/players`: return normalized Yahoo player metadata.
- `GET /api/yahoo/drafts/:draftId`: return normalized draft state if available.

## Recommended Implementation

Start with a small serverless backend. Cloudflare Workers, Vercel Functions, or Netlify Functions are all compatible with the current frontend adapter.

The frontend integration point is `src/providers/yahoo/YahooProvider.ts`. Once a backend URL exists, instantiate the provider with:

```ts
const yahooProvider = new YahooProvider({
  backendBaseUrl: "https://your-backend.example.com"
});
```

Keep the backend responsible for Yahoo-specific API shapes. The browser app should only receive the normalized fantasy football models used by Sleeper today.
