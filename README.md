# Lyf — Event & Lifestyle Marketplace (MVP)

Plan weddings and events: budget wizard, vendor discovery, booking, and Paystack deposits.

## Stack
- Client: React 18, Vite, Tailwind
- Server: Node 20+, Express, PostgreSQL (Supabase or local)
- Payments: Paystack (deposits, webhook-confirmed)

## Folder layout

Open the folder that directly contains `client` and `server`. Run every command from inside one of those two folders.

```
lyf/
  client/   React app (src/pages, src/components, src/lib)
  server/   Express API (schema.sql, src/*.js)
```

## Run locally

1. Database with Supabase (no local install):
   - Create a project at supabase.com and save the database password.
   - Open SQL Editor, paste all of `server/schema.sql`, and run it. This creates the tables, adds 6 sample vendors, and turns on row level security.
   - Click Connect, choose Session pooler, and copy the connection string.

   Prefer local Postgres? Run `createdb lyf` and `psql lyf -f server/schema.sql` instead.

2. Start the API:

   ```
   cd server
   copy .env.example .env     (Windows)   |   cp .env.example .env   (Mac/Linux)
   ```

   Edit `.env`: one `DATABASE_URL=` line with your connection string, a long random `JWT_SECRET`, and your Paystack test key. Then:

   ```
   npm install
   npm run dev
   ```

3. Start the client in a second terminal:

   ```
   cd client
   npm install
   npm run dev
   ```

   Open http://localhost:5173.

4. Open the app. Signed-out visitors see the landing page. Tap Get started to create an account, or Sign in. Emailed codes print in the server terminal while no email key is set.

## Vendor accounts

Anyone can sign in as a planner or as a vendor (pick at sign-in; it's fixed when the account is created).

- Vendors set up their business, then see booking requests on their dashboard.
- A vendor accepts (with their own price) or declines. The planner can only pay the 30% deposit after acceptance.
- A phone number is optional. If given, it stays hidden on both sides until the vendor accepts, then each gets a WhatsApp link.
- After the deposit is paid, the vendor can mark the booking as done.
- The 6 sample vendors have no owner, so requests to them are confirmed automatically. This keeps payments testable.

Already have a database from an earlier version? Run `server/migrations/001_vendor_accounts.sql` once in the Supabase SQL Editor. New databases get everything from `schema.sql`.

## Vendor portfolio (photos and videos)

Vendors add their past work on the Work tab. Planners see a preview on each vendor card and can open the full gallery.

- Photos up to 10 MB (shrunk on the phone before upload) and videos up to 50 MB: JPEG, PNG, WebP, MP4, MOV, WebM. Up to 30 items per vendor.
- The server checks what each file really is, so a renamed file can't slip through.
- **Development:** files are saved in `server/uploads`. Nothing to set up.
- **Online:** hosts like Render erase that folder on every deploy, so use Supabase Storage. Create a public bucket named `portfolio`, then set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `server/.env` (see `.env.example`). The service key is a secret. Keep it on the server only.
- Run `server/migrations/002_vendor_portfolio.sql` once on an existing database, then `npm install` in `server` (adds the `multer` package).

## Ratings and reviews

- A planner can rate a vendor (1 to 5 stars, optional comment up to 500 characters) once the vendor marks the job done, or once the event date has passed. One review per booking. Reviews can't be edited or deleted.
- Vendor cards show the average and review count, and the gallery lists reviews with the planner's first name only.
- New vendors show "New" until their first review. The 6 sample vendors keep their made-up scores until a real review replaces them.
- Run `server/migrations/003_reviews.sql` once on an existing database.

## Sign in, email and the admin portal

**Sign in.** Visitors land on a page that explains Lyf. Returning users sign in with email and password, or tap "Email me a sign-in code" to get a 6-digit code (valid 10 minutes, one use, 5 tries). New users create an account with name, email and password; a WhatsApp number is optional. "Forgot password?" emails a reset link that works for 60 minutes. After 5 wrong passwords in 15 minutes, that email is paused for 15 minutes. There is no SMS sign-in for now.

**Accounts that were created with a phone code.** They have no email, so they can no longer sign in. In `server`, run `npm run set-email -- 08012345678 you@example.com` once for each, then sign in with an emailed code.

**Emails.** Lyf emails people when: they join, they reset or change a password, a vendor gets a booking request, a vendor accepts or declines, a deposit is paid (planner and vendor), and a vendor gets a review. Email goes through [Resend](https://resend.com):

1. Create a Resend account and an API key.
2. Add to `server/.env`: `RESEND_API_KEY=re_...`, `MAIL_FROM=Lyf <hello@yourdomain.com>` and `APP_URL=https://your-app-address`.
3. Resend only delivers to other people once you verify your own domain in their dashboard. Until then it only delivers to your own Resend account email.

With no `RESEND_API_KEY`, emails are printed in the server terminal (reset links included), so development needs no setup. Every email, sent or failed, is listed in the admin Email log.

**Admin portal.** Open `/admin` (for example http://localhost:5173/admin) after signing in with an admin account. Nobody can become admin from the app. To make an admin: register normally, then run this once in `server`:

```
npm run make-admin -- you@example.com
```

It has Overview (totals, sign-ups chart, live activity, email log), Users (search, suspend, reactivate), Vendors (verify, hide), Bookings, Payments (with CSV download), and Moderation (remove reviews, photos and videos). Suspending a user signs them out at once and hides their business from planners. Every admin action is recorded and shows in the activity feed.

Run `server/migrations/004_email_auth_admin.sql` and then `server/migrations/005_email_codes_optional_phone.sql` once on an existing database. After unzipping, run `npm install` in `client` (it adds two fonts) and delete the unused `server/src/notify.js`.

## Troubleshooting

- `ECONNREFUSED ... :5432` means the server can't see `DATABASE_URL`. Check `server/.env`, save it, and restart the server.
- `ENOTFOUND db.xxxx.supabase.co` means you used the Direct connection string. Use the Session pooler string.
- `bg-ink class does not exist` means Tailwind is reading an old `client/tailwind.config.js`. Replace it with the one in this project and restart `npm run dev`.

## Tests

```
cd server
npm test
```

Covers the budget allocator: the ₦350,000 wedding split, exact-sum guarantee, small-budget collapsing, and rebalance tips.

## Paystack webhook

Point your Paystack dashboard webhook to `POST /api/webhooks/paystack`. For local testing, expose port 4000 with a tunnel such as ngrok. The webhook verifies the signature, checks the amount, marks the booking `deposit_paid`, updates category spend, and awards 1 point per ₦100.

## Before going live

- Phone codes were removed. If you add SMS later (Termii or Africa's Talking), put it behind the same sign-in code screen. Sign-in code limits live in memory, so use a shared store if you run more than one server.
- Sign-in codes are already hashed in the database.
- Email addresses are not verified yet. Anyone can sign up with any address, and only the password reset proves ownership.
- Switch the database SSL setting in `server/src/db.js` from `rejectUnauthorized: false` to Supabase's CA certificate.
- Vendors are seeded manually. Add an admin flow or a simple form for onboarding your first 20–30 vendors.
- Holding or splitting funds needs a licensed PSP arrangement. This MVP only collects deposits through Paystack.
- Never share `server/.env` or commit it. It holds your database password.
