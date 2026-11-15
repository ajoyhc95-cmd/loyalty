# Loyalty Loop

Mobile-first loyalty points management app built with Next.js, PostgreSQL, and Vercel deployment.

## Database

Create a PostgreSQL database using the Vercel Marketplace, such as the Neon integration, and connect it to the Vercel project. Use the provider's pooled connection string as `DATABASE_URL` (or `POSTGRES_URL`). For local development, copy it into `.env.local`; the database scripts load `.env.local` automatically. Never commit credentials.

Set these Vercel Project → Settings → Environment Variables for Production and Preview as appropriate:

- `DATABASE_URL`: the PostgreSQL provider's pooled connection string.
- `SESSION_SECRET`: a unique cryptographically random value of at least 32 characters. Keep it stable across deployments.

Apply the schema and create the first administrator from a trusted local machine. Use a protected production database connection for these one-time setup commands:

```powershell
npm run db:migrate
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "a-unique-password-of-at-least-12-characters"
npm run db:seed-admin
```

The seed command creates the initial admin only when no admin already exists. Do not set `ADMIN_PASSWORD` in Vercel's runtime environment.

## Deploy to the Vercel project

The target project is [loyalty](https://vercel.com/loyalty-0aa5/loyalty/9kmNRnSdW1RzSDjGYEb8UZvaukZj). In that project's **Settings → Git**, connect the Git repository containing this workspace. Vercel detects Next.js automatically; use the repository root as the Root Directory and leave the default Next.js build settings. Add the environment variables above, attach the PostgreSQL Marketplace integration, then push the deployment branch to trigger a build. Run `npm run db:migrate` and `npm run db:seed-admin` from a trusted machine before signing in.

The deployment target should be connected to the repository's `main` branch so a push triggers a Vercel build. If the project is connected to a different repository or branch, update its Git settings before pushing.

## Run locally

Use Node.js 20 or newer, then:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The app is available at `http://localhost:3000`. To verify a production build, run `npm run typecheck` and `npm run build`.

## Implemented flows

- Admin, Agent, Merchant, and Customer sign-in with role-specific server authorization.
- Signup requests, Admin approval/rejection, generated user IDs, accounts, and optional printable ID cards.
- Primary and Secondary Admin accounts, account balances, transaction ledger, and lifetime issuance alert.
- Admin point issuance, Primary Account distributions, coupon generation, coupon redemption, and configurable quiz reward percentages.
- Customer-to-Merchant/Agent transfers and Merchant-to-Customer discounts; browser camera barcode scanning is available where `BarcodeDetector` is supported, with manual entry as fallback.
- Fractional points are supported to two decimal places. Ledger movements are atomic and internal transfers are balanced.
- Generated coupons are backed by available Primary Account points; Admin distributions cannot spend points promised to unredeemed coupons.
- Automatic balance sweeps are intentionally not implemented.

The initial four-question quiz is seeded with the database schema. Plan percentages can be changed from the Admin dashboard; each row must total 100%.
