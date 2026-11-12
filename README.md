# Eleos — digital banking demo for Nigeria

Eleos is a full-stack digital banking web app: balances, bank transfers with
account-name verification, airtime and data, electricity / cable TV / internet
bills, betting wallet funding, transaction history with receipts and CSV export,
beneficiaries, a virtual card, and profile & security settings.

> **Demo mode.** Every balance and transaction is simulated. No real money
> moves, and nothing is sent to any bank, telco, biller or betting operator.
> The app is presented as a finished product, without demo notices in the UI;
> printable receipts carry a faint "DEMO" watermark and the line "Demo receipt —
> not proof of payment" so they can't pass as real payment proof. Live payments
> are blocked until a real provider adapter is implemented and verified (see
> [Live integrations](#live-integrations)).

Each demo account starts with **₦45,140,708.60** in simulated funds and about
five months of sample history.

---

## Quick start (no setup needed)

Requirements: Node.js 20.9+ (tested on Node 24) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **Explore the demo account**.

With no environment variables set, Eleos runs in **local demo mode**:

- Data lives in a JSON store on the server at `.data/eleos-demo-db.json`
  (git-ignored). It persists across restarts and reloads, and the balance is
  never re-seeded on reload.
- Sign-in uses local, HTTP-only cookie sessions. Passwords and PINs are stored
  only as salted scrypt hashes.

You can also **create an account**. Every new account gets its own simulated
₦45,140,708.60 balance. To start over, go to **Settings → Reset**, or delete
`.data/`.

### Demo test inputs

The simulated providers behave deterministically, so you can trigger every
state:

| Input | Result |
| --- | --- |
| Account number `0000000000` or `1111111111` | Account-name verification fails |
| Account / phone / meter / smartcard / customer ID ending in **`0000`** | Provider declines the payment. It is recorded as **failed** and the money is returned automatically |
| …ending in **`9999`** | Stays **pending** (funds held). Use **Check status** after ~20 s to settle it |
| Customer ID that is all zeros | Bill or betting customer lookup fails |
| Freeze the virtual card, then **Make a purchase** | The purchase is declined, with no money moved |
| Amount above the balance, a negative amount, or more than 2 decimals | Rejected with a clear message |

Saved beneficiaries (Amaka Obi – GTBank `0214587793`, Chinedu Eze – Access
`0692284415`, and others) resolve to their demo names. Any other 10-digit number
resolves to a deterministic, simulated name.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (Next.js + React hooks rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: banking engine, seed, validation, formatting, mapping |
| `npm run check` | typecheck + lint + test |
| `npm run db:seed` | Create the shared demo login in Supabase and provision its account (`-- --reset` to re-seed) |

---

## Connecting Supabase (optional)

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/20261112000000_eleos_schema.sql`.
   Either paste it into the SQL editor, or run
   `supabase link && supabase db push` with the Supabase CLI.
   (`20261112120000_neutral_credit_reference.sql` is already folded into the
   main schema; it only updates projects created before it. Re-running it is
   harmless.)
3. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the
     legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY` (**server only**). Every balance change runs
     through Postgres functions that only the service role can execute.
   - `NEXT_PUBLIC_APP_URL`, used in email confirmation and reset links.
4. In Supabase **Auth → URL configuration**, add
   `<APP_URL>/auth/callback` as a redirect URL.
5. Set up demo access, choosing one of:
   - **Recommended for public deployments:** set `DEMO_ACCOUNT_EMAIL` and
     `DEMO_ACCOUNT_PASSWORD`, then run `npm run db:seed`. This creates one
     shared demo login that every visitor uses. Its email, password and
     transaction PIN can't be changed, so no visitor can lock the others out.
     Reset it any time with `npm run db:seed -- --reset`.
   - Or enable **anonymous sign-ins** in Supabase Auth. Each visitor then gets
     a private demo account, but every click adds a permanent account with
     roughly 350 rows of sample history (ledger rows are append-only), so the
     database grows with traffic.
6. Restart the app.

Any user who signs in (email/password or demo) gets a demo account provisioned
on first visit, using the same seed builder as local mode.

---

## Deploying to Vercel

1. Push the repository and import it in Vercel. No build settings need changing.
2. Add the environment variables from `.env.local`: the Supabase URL and keys,
   `NEXT_PUBLIC_APP_URL` set to the production URL, and `DEMO_ACCOUNT_EMAIL` /
   `DEMO_ACCOUNT_PASSWORD` if you use the shared demo login.
3. Deploy.
4. In Supabase **Auth → URL configuration**, set the Site URL to the
   production URL and add `<production URL>/auth/callback` as a redirect URL.

Without Supabase, a Vercel deployment still works, but serverless filesystems
are ephemeral. The local store lives in the instance's temp directory and resets
whenever an instance is recycled. Use Supabase for anything you want to keep.

---

## Architecture

```
src/
  app/                 Next.js App Router (16.x)
    (auth)/            sign-in, sign-up, forgot/reset password
    (app)/             authenticated shell: overview, transfer, airtime, bills, betting,
                       transactions, beneficiaries, cards, settings
    receipt/[id]/      printable receipt (owner-only)
    api/transactions/export/   CSV export (owner-only)
    auth/callback/     Supabase email-link handler
  proxy.ts             session refresh + optimistic route protection (Next 16 "proxy")
  actions/             server actions — the only entry points for mutations
  components/          UI (shadcn/ui primitives in components/ui)
  lib/                 shared, framework-free: money, validation (Zod), catalogs, analytics
  server/
    engine/payments.ts transaction engine (quote → PIN → reserve → provider → settle)
    providers/         provider-adapter interfaces + the DEMO simulator
    repository/        BankRepository interface; local + Supabase implementations
    seed/demo-seed.ts  one seed builder for both backends
    auth/              sessions, scrypt hashing
supabase/migrations/   schema, RLS, ledger functions
tests/                 Vitest suites
```

### Money and ledger rules

- All money is an **integer number of kobo** (`bigint` in Postgres). Formatting
  is centralised in `src/lib/money.ts` and always shows naira (₦).
- Every balance change writes **ledger entries**: principal, fee, credit,
  reversal, and a computed opening entry. A Postgres deferred constraint trigger
  (and an equivalent check in the local store) refuses to commit if an account's
  balance differs from the sum of its ledger entries.
- The opening entry is calculated so that, after all sample history, the balance
  is exactly ₦45,140,708.60.

### Payment flow

1. The form is validated client-side with the same Zod schemas the server uses.
2. **Quote** (server): the amount is re-parsed, plan prices come from the
   server catalogue, fees from the fee schedule, and names from the
   verification provider.
3. **Confirmation screen**: recipient, masked account, amount, fee, total, and
   balance after. A PIN is required if the user has set one (locks after 5
   wrong attempts).
4. **Execute** (server) with a per-confirmation **idempotency key** and the
   total the user confirmed. If the server's total differs, the payment is
   refused.
5. **Reserve** (atomic): ownership check, balance check, debit and ledger
   entries, and a `pending` transaction with a unique reference. A repeated
   key returns the original result and never debits twice. Reusing a key for a
   different payload is rejected.
6. **Provider call** through the adapter interface.
7. **Settle**: `successful`, `failed` (automatic reversal entry, balance
   restored), or `pending` (held; re-queried with **Check status**). An
   unknown provider outcome stays pending; the engine never guesses.

In Supabase these steps are `SECURITY DEFINER` functions
(`app_reserve_debit`, `app_settle_transaction`, `app_post_credit`, …). They lock
the account row (`FOR UPDATE`), and `EXECUTE` is revoked from `anon` and
`authenticated`. Server actions verify the session with `auth.getUser()`, then
call them with the service role and the verified user id. The browser can never
call them.

### Security notes

- **Row Level Security** is enabled on every table. Users can read only their
  own rows.
  - Accounts, transactions and ledger entries are read-only for users.
  - Users can fully manage their own beneficiaries.
  - Profile, card controls and notifications are updatable through
    column-level grants only.
  - PIN hashes live in `user_security`, which has no client policies at all.
- Every action re-validates input and re-reads the session. A user id, amount,
  fee or status is never taken from the client.
- `TRUNCATE`, `REFERENCES` and `TRIGGER` are revoked from API roles, because
  RLS does not cover them.
- Secrets are read only on the server. Only `NEXT_PUBLIC_SUPABASE_URL` and the
  publishable key reach the browser.
- CSV export neutralises spreadsheet formula injection. Account numbers are
  masked in lists and on receipts.
- Security headers are set: `X-Frame-Options`, `nosniff`, `Referrer-Policy` and
  `Permissions-Policy`.

---

## What is simulated vs. genuinely implemented

| Area | Status |
| --- | --- |
| Balances, ledger, idempotency, atomic posting, reversals | **Implemented** (local store and Postgres) |
| Auth: sign-up, sign-in, sign-out, sessions, password change, PIN | **Implemented**. Local mode uses its own sessions; Supabase mode uses Supabase Auth |
| Password-reset emails | **Supabase only**. Local mode explains that no email can be sent |
| Row Level Security, constraints, indexes | **Implemented** in the migration |
| Bank account-name verification | **Simulated** (demo directory plus deterministic names) |
| Bank transfers (NIP) | **Simulated**. No money leaves |
| Airtime and data | **Simulated**. Nothing is delivered; bundles and prices are illustrative |
| Electricity, cable TV, internet, water/waste | **Simulated**. Customer names and prepaid tokens are fake |
| Betting wallet funding (SportyBet, Bet9ja, …) | **Simulated**. No funds reach any betting account |
| Virtual card | **Simulated**. Only the last 4 digits exist; no PAN, CVV or PIN is generated |
| Email / SMS / push alerts | **Preferences stored only**. Nothing is sent; in-app notifications are real |
| Charts and analytics | **Implemented**, computed from your actual transaction data |

---

## Live integrations

Adapters live in `src/server/providers`. The engine depends only on these
interfaces:

| Interface | Purpose | Candidates to evaluate |
| --- | --- | --- |
| `AccountVerificationProvider` | Resolve account names | Paystack (Resolve Account Number) |
| `TransferProvider` | Send interbank transfers and requery them | Paystack Transfers |
| `TelcoProvider` | Airtime and data | Flutterwave Bills, VTU aggregators |
| `BillsProvider` | Electricity, cable, internet, utilities | Flutterwave Bills |
| `BettingFundingProvider` | Betting wallet funding | Only via a licensed partner that explicitly supports it |

Setting `PAYMENTS_MODE=live` without implementing these makes every payment fail
loudly, with no reservation kept. It never silently falls back to the
simulator.

Before enabling anything live:

1. **Confirm the commercial terms.** Check current product availability,
   account eligibility, KYC tiers, fees and CBN regulatory requirements with
   each provider. The fee schedule and limits in `src/lib/fees.ts` are demo
   values.
2. **Build against sandbox keys.** Implement against the provider's
   test/sandbox environment. Keep keys in server-only environment variables
   such as `PAYSTACK_SECRET_KEY`.
3. **Send our reference.** Pass our transaction `reference` as the provider's
   idempotency/merchant reference.
4. **Verify outcomes on the server.** Confirm final status with the provider,
   and validate webhook signatures before settling.
5. **Settle only through the engine.** A webhook handler should call
   `refreshPendingTransaction`/`settleTransaction`, never update balances
   directly.
6. **Reconcile.** Add a scheduled job that requeries every transaction that
   stays `pending`, and handle provider-initiated reversals.
7. **Keep fakes out of live paths.** Replace the illustrative catalogues
   (bundles, plans) with the provider's live product list.

Do not present a simulated service as a real integration.

---

## Testing

`npm test` covers:

- the initial balance of ₦45,140,708.60 and a seeded ledger that sums to it
- a successful transfer debiting amount + fee exactly once
- insufficient balance, invalid and negative amounts, and over-precision
- duplicate and concurrent submissions with the same idempotency key, and key
  reuse with a different payload
- provider failures with automatic reversal, pending → requery → settled, and
  verification failures
- PIN required, invalid and lockout
- balance = Σ ledger = opening + transaction effects after mixed activity
- user data isolation (reads, updates, deletes, settles, receipts) across users
- the card freeze and limits, credits, Lagos-time formatting, query parsing, and
  Supabase row mapping

The engine tests run against an in-memory instance of the same repository used
in local mode. The Postgres functions mirror that logic.
