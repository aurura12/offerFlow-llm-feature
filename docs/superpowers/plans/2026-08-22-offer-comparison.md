# Offer Comparison Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Add a simple domestic Offer decision view that lists jobs at the Offer stage, stores structured Offer facts, and calculates estimated annual cash.

Architecture: Keep Job responsible for the application pipeline and add a one-to-one Offer record for structured Offer information. Expose Offers through authenticated API routes and AppContext; render /offers as a first-class page that opens the existing JobDetailModal for editing.

Tech Stack: Next.js 16 App Router, React 19, Prisma 6, SQLite/PostgreSQL schemas, Node built-in test runner, Tailwind CSS.

Spec: docs/superpowers/specs/2026-08-22-offer-comparison-design.md

## Global Constraints

- Only domestic civil-service, central/state-owned-enterprise, and private R&D Offers are in scope.
- All monetary values are non-negative RMB values.
- Estimated annual cash is monthlyBaseYuan * salaryMonths + annualBonusYuan.
- Missing monthly salary or salary-month count produces an incomplete result, not zero.
- Do not add AI, scoring, city cost-of-living data, tax estimation, equity valuation, or automatic recommendations.
- Offer deletion removes only Offer information and never deletes the related Job.

---

### Task 1: Add and test the pure Offer calculation utility

Files:
- Create: src/lib/offerComparison.js
- Create: tests/offerComparison.test.mjs

Interfaces:
- parseOfferInput(value) returns { ok: true, data } or { ok: false, error }.
- calculateAnnualCash(offer) returns a number or null.

- [ ] Step 1: Write the failing tests.

Test these cases: 20000 x 14 + 10000 equals 290000; missing monthly salary or salary months returns null; missing bonus is zero; negative or non-numeric salary input is rejected; empty optional fields become null and text is trimmed.

Use the existing Node test runner with imports from ../src/lib/offerComparison.js.

- [ ] Step 2: Run the focused test and verify it fails.

Run: node --test tests/offerComparison.test.mjs

Expected: FAIL because src/lib/offerComparison.js is absent.

- [ ] Step 3: Implement the minimal utility.

parseOfferInput must normalize monthlyBaseYuan, salaryMonths, annualBonusYuan, city, decisionDeadline, benefits, and notes. Numeric fields accept empty values as null, reject negative or non-finite values, and dates must be YYYY-MM-DD or empty. calculateAnnualCash returns null when monthly salary or salary months is missing; otherwise it returns the formula above with missing bonus treated as zero.

- [ ] Step 4: Run the focused test and commit.

Run: node --test tests/offerComparison.test.mjs

Expected: all tests PASS.

~~~bash
git add src/lib/offerComparison.js tests/offerComparison.test.mjs
git commit -m "feat: add simple offer cash calculation"
~~~

### Task 2: Add the Prisma Offer model and API

Files:
- Modify: prisma/schema.prisma
- Modify: prisma/schema.sqlite.prisma
- Modify: prisma/schema.pg.prisma
- Create: prisma/migrations/20260822090000_add_offers/migration.sql
- Create: src/app/api/offers/route.js
- Create: src/app/api/jobs/[id]/offer/route.js

Interfaces:
- GET /api/offers returns the current user's Offers with a Job summary.
- PUT /api/jobs/[id]/offer creates or updates the Offer for an owned Job.
- DELETE /api/jobs/[id]/offer deletes only the Offer for an owned Job.

- [ ] Step 1: Add the model to all Prisma schemas.

Add offers Offer[] to User, offer Offer? to Job, and this model to each schema:

~~~prisma
model Offer {
  id               String   @id @default(cuid())
  userId           String
  jobId            String   @unique
  monthlyBaseYuan  Int?
  salaryMonths     Float?
  annualBonusYuan  Int?
  city             String?
  decisionDeadline String?
  benefits         String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([userId])
}
~~~

- [ ] Step 2: Add and validate the SQLite migration.

Create the Offer table with a unique job_id, foreign keys to users and jobs, nullable monetary/text fields, timestamps, and an index on user_id. Run npm run db:generate and npx prisma validate; both must succeed.

- [ ] Step 3: Implement GET /api/offers.

Require getAuthUser(), return 401 when unauthenticated, and query prisma.offer.findMany with the current user id, updatedAt descending, and Job fields id, companyName, jobTitle, status, city, and appliedDate.

- [ ] Step 4: Implement PUT /api/jobs/[id]/offer.

Verify the Job belongs to the current user. Validate the body with parseOfferInput. Use prisma.offer.upsert with jobId as the unique key; take userId from the session, never from the request body. Return 400 for invalid fields, 404 for an unknown or unowned Job, and the saved Offer on success.

- [ ] Step 5: Implement DELETE /api/jobs/[id]/offer.

Verify ownership through the Job, delete by jobId, and return { success: true }. Deleting a missing Offer is idempotent. Do not delete or update the Job.

- [ ] Step 6: Validate and commit.

~~~bash
npm run db:generate
npx prisma validate
npm run build
git add prisma/schema.prisma prisma/schema.sqlite.prisma prisma/schema.pg.prisma prisma/migrations/20260822090000_add_offers/migration.sql src/app/api/offers/route.js src/app/api/jobs/'[id]'/offer/route.js
git commit -m "feat: add offer storage and API"
~~~

### Task 3: Expose Offer data through AppContext

Files:
- Modify: src/store/AppContext.jsx

Interfaces:
- useApp().offers contains the API records.
- useApp().upsertOffer(jobId, formData) saves and returns an Offer.
- useApp().deleteOffer(jobId) deletes only the Offer.

- [ ] Step 1: Add state and loading.

Add offersRaw state. Fetch /api/offers alongside jobs, resumes, tasks, and reviews. Persist successful data under offerFlow_offers. In the existing fallback path, load that key or use [].

- [ ] Step 2: Implement upsertOffer.

Call PUT /api/jobs/{jobId}/offer, replace an existing local record with the same jobId or append it, persist offerFlow_offers, and return the saved record. Surface errors through the existing addToast pattern.

- [ ] Step 3: Implement deleteOffer and expose the API.

Call DELETE /api/jobs/{jobId}/offer, filter local state by jobId, persist it, and expose offers, upsertOffer, and deleteOffer from the Provider value without changing existing Job methods.

- [ ] Step 4: Run tests and commit.

~~~bash
npm test
node --test tests/offerComparison.test.mjs
git add src/store/AppContext.jsx
git commit -m "feat: expose offers through app context"
~~~

### Task 4: Add /offers and the navigation entries

Files:
- Create: src/app/(main)/offers/page.jsx
- Create: src/views/Offers.jsx
- Modify: src/components/Sidebar.jsx
- Modify: src/components/BottomNav.jsx
- Modify: src/views/Dashboard.jsx

- [ ] Step 1: Create the route wrapper.

Match existing wrappers: a client page imports Offers from @/views/Offers and returns <Offers />.

- [ ] Step 2: Add navigation.

Add an offers item labeled Offer 对比 to Sidebar.jsx and an offers item labeled Offer to BottomNav.jsx. Reuse the existing route matching and router.push('/offers') behavior.

- [ ] Step 3: Make the dashboard Offer statistic navigable.

Keep the count based on job.status === 'Offer', but make the Offer statistic card navigate to /offers using the existing Next router/link pattern.

- [ ] Step 4: Implement the card list.

In Offers.jsx, join jobs and offers by jobId, and include records when job.status === 'Offer' or an Offer record exists. Each card shows company, title, city, monthly salary, salary months, bonus, calculated annual cash, and decision deadline. Use calculateAnnualCash; render 信息不完整 for null.

- [ ] Step 5: Open the existing JobDetailModal.

Keep detailJobId state, set it when a card is clicked, and render the existing JobDetailModal with open, jobId, and onClose. Do not create a second detail drawer.

- [ ] Step 6: Build, manually verify, and commit.

Manual checks: both navs reach /offers; Offer cards render; non-Offer Jobs do not; empty state renders; clicking a card opens the correct Job detail.

~~~bash
npm run build
git add src/app/'(main)'/offers/page.jsx src/views/Offers.jsx src/components/Sidebar.jsx src/components/BottomNav.jsx src/views/Dashboard.jsx
git commit -m "feat: add offer comparison page"
~~~

### Task 5: Add Offer editing to JobDetailModal

Files:
- Modify: src/components/JobDetailModal.jsx

- [ ] Step 1: Add Offer form state.

Read offers, upsertOffer, and deleteOffer from useApp(). Initialize from the saved Offer, defaulting city to job.city and all other fields to empty values. Reset when open, jobId, or the matching Offer changes.

- [ ] Step 2: Render the Offer section.

Show it when job.status === 'Offer' or a saved Offer exists. Add inputs for monthly salary, salary months, annual bonus, city, decision deadline, benefits, and notes, plus a read-only estimated annual cash line.

- [ ] Step 3: Save and delete.

Save through upsertOffer(jobId, form), use the utility/API validation, and show success/error Toast messages. Delete only the Offer after confirmation; leave the Job and its timeline untouched.

- [ ] Step 4: Preserve existing modal behavior.

Do not change status shortcuts, Job deletion, tasks, interview reviews, or timeline events.

- [ ] Step 5: Test, build, and commit.

~~~bash
npm test
node --test tests/offerComparison.test.mjs
npm run build
git add src/components/JobDetailModal.jsx
git commit -m "feat: edit offer information in job details"
~~~

### Task 6: Final verification

Files: only files from Tasks 1–5 if a verification fix is required.

- [ ] Step 1: Run the full suite.

~~~bash
npm test
node --test tests/offerComparison.test.mjs
npx prisma validate
npm run db:generate
npm run build
~~~

- [ ] Step 2: Verify the primary flow.

Change a Job to Offer, open /offers from the sidebar, open the card, enter 20000, 14, and 10000, save, confirm annual cash is 290000 / 29万, reload and confirm persistence, delete Offer information, confirm the Job remains, and confirm a non-Offer Job is absent.

- [ ] Step 3: Inspect the final diff.

~~~bash
git diff --check
git status --short
git log -6 --oneline
~~~

Expected: no whitespace errors and only intended Offer feature files changed.
