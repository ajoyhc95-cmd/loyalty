# Loyalty Loop

Mobile-first loyalty points management app built with Next.js, PostgreSQL, and Vercel deployment.

## Database

Create a PostgreSQL database using the Vercel Marketplace, such as the Neon integration, and connect it to the Vercel project. Use the provider's pooled connection string as `DATABASE_URL` (or `POSTGRES_URL`). For local development, copy it into `.env.local`; never commit credentials.

Apply the schema and create the first administrator from a trusted local machine:

```powershell
$env:DATABASE_URL = "your-vercel-postgres-connection-string"
$env:SESSION_SECRET = "a-random-secret-with-at-least-32-characters"
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "a-unique-password-of-at-least-12-characters"
npm run db:migrate
npm run db:seed-admin
```

Set `DATABASE_URL` and `SESSION_SECRET` in the Vercel project's environment variables. `SESSION_SECRET` should be generated from a cryptographically secure random source and kept stable between deployments.

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
