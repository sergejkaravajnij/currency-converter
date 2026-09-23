# Currency Calculator

An adaptive Vue currency calculator backed by a scheduled Cloudflare Worker. Rates for USD, GEL, RUB, EUR, GBP, and PLN are sourced from the National Bank of Georgia; IDR is derived from the ECB daily EUR/IDR reference rate because NBG does not publish IDR.

## Local setup

```bash
npm install
npm run dev
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and set `VITE_API_BASE_URL` to your deployed Worker URL. For local Worker testing, create a KV namespace, add its ID to `apps/worker/wrangler.toml`, run `npm run dev --workspace=@currency-calculator/worker`, and set the frontend API URL to `http://localhost:8787`.

## Deploy

1. Create a Cloudflare KV namespace and replace `REPLACE_WITH_KV_NAMESPACE_ID` in `apps/worker/wrangler.toml`.
2. Set `ALLOWED_ORIGINS` to the deployed Pages origin (comma-separated values are supported).
3. Deploy the Worker with `npm run build --workspace=@currency-calculator/worker` after authenticating Wrangler.
4. Deploy `apps/web` to Cloudflare Pages using build command `npm run build --workspace=@currency-calculator/web` and output directory `apps/web/dist`; set `VITE_API_BASE_URL` to the Worker URL.
5. Verify the first scheduled refresh locally with `wrangler dev --test-scheduled`, then send the scheduled event in the Wrangler dashboard. The production schedule is 13:15 UTC daily.

Run verification with `npm test` and `npm run build`.
