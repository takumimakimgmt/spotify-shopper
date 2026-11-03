# Env Contract (Frontend)

## Keys (Vercel)

- NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" (public)

- NEXT_PUBLIC_BEATPORT_A_AID: Beatport affiliate ID (`a_aid`, public).
  Set the actual ID in `.env.local` and the hosting environment, then rebuild/redeploy.
  When configured, this ID replaces existing `a_aid` values on Beatport links,
  including links restored from Buy Later. Without it, no ID is added.

## Forbidden

- Committing any .env except .env.example (dummy only)
