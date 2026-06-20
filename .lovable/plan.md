# Manrope + VDNX build rules + sidebar sub-page audit

## 1. Typography — Manrope everywhere

Replace the current Playfair Display + Inter pairing with **Manrope** (UI/body) and **JetBrains Mono** (mono accents), matching VDNX.

- `src/routes/__root.tsx` — add Google Fonts `<link>` tags in the root `head` (preconnect + Manrope 200–800 + JetBrains Mono 400–600 stylesheet). Remote fonts must be loaded via `<link>`, never `@import` in Tailwind v4.
- `src/styles.css`:
  - Remove the `@fontsource/playfair-display/*` and `@fontsource/inter/*` `@import` lines.
  - In `@theme inline`, set `--font-sans: "Manrope", system-ui, sans-serif;` and `--font-display: "Manrope", system-ui, sans-serif;` (single family, no serif). Add `--font-mono: "JetBrains Mono", ui-monospace, monospace;`.
- Remove `@fontsource/playfair-display` and `@fontsource/inter` from `package.json`.
- Sweep components for `font-display` / serif usage — keep the class names but they now resolve to Manrope automatically; no per-component edits needed unless a component hardcoded a family.

## 2. Apply VDNX build rules to the dialer app

From `docs/FRONTEND_SECURITY_CONTRACT.md` in VDNX:

- **No hardcoded colors.** Sweep `src/components/**` and `src/routes/**` for `bg-white`, `bg-black`, `text-white`, `text-black`, `bg-[#…]`, `text-[#…]`, `border-[#…]` and replace with semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `border-border`, etc.).
- **HSL/OKLCH only inside CSS tokens** — already the case in `src/styles.css`; verify no raw hex creeps in.
- **200-line cap per component.** Files over 200 LOC get split into presentational sub-components under `src/components/<feature>/`:
  - `clients.tsx` (278) → extract `ClientsTable`, `ClientFiltersBar`.
  - `campaigns.tsx` (224) → extract `CampaignCard`, `CampaignCreateDialog`.
  - `settings/connections.tsx` (277) → extract `ConnectionCard`, `ConnectionCreateForm`.
  - `settings/telephony.tsx` (297) → extract `TelephonyConfigForm`, `TelephonyTestPanel`.
  - `settings/teams.tsx` (257) → extract `TeamRow`, `TeamCreateDialog`.
  - `settings/api-keys.tsx` (213) → extract `ApiKeyRow`.
- **Toasts**: confirm only `sonner` is used (no `useToast` from radix). Replace any leftover.
- **HTML interpolation**: any `dangerouslySetInnerHTML` must route through DOMPurify. Audit; today the app shouldn't have any.
- **React.memo** on row/card sub-components extracted above.
- **No new third-party scripts**, no new analytics, no new fonts beyond Manrope + JetBrains Mono.
- **Route table is frozen** during this pass — no sidebar links added/removed/reordered; the sub-pages listed below already exist and only get content/polish.

## 3. Sidebar sub-page audit (no new routes, polish only)

All routes are already in place. Each page gets a content/UX pass to ensure it actually renders the intended feature with empty/loading/error states and uses only design tokens:

| Sidebar item | Route | Status |
|---|---|---|
| Clients | `/clients` | exists — split + add empty/loading states |
| Call history | `/history` | exists — add filters (date, outcome) using tokens |
| Reminders | `/reminders` | exists — confirm overdue badge uses `bg-destructive/10` |
| AI Campaigns | `/campaigns` | exists — split, add create dialog skeleton |
| Supervisor | `/supervisor` | exists — confirm co-listen panel uses tokens |
| Activity | `/activity` | exists — confirm chart colors come from `--chart-*` |
| Settings → Workspace | `/settings/organization` | exists — token sweep |
| Settings → Teams | `/settings/teams` | exists — split |
| Settings → Telephony | `/settings/telephony` | exists — split |
| Settings → API keys | `/settings/api-keys` | exists — split |
| Settings → Connections | `/settings/connections` | exists — split |
| Settings → API & MCP docs | `/settings/api-docs` | exists — token sweep |

No business-logic changes: server functions, migrations, auth middleware, sidebar route map, and `__root.tsx` providers are untouched aside from adding the font `<link>` tags.

## 4. Out of scope

- No new sidebar items or routes.
- No backend / migration changes.
- No copy rewrite beyond what's needed to fit the new typography.
- Cron jobs, Telavox wiring, and API-key issuance flow stay as-is.

## 5. Acceptance

- App renders entirely in Manrope (verify via preview screenshot).
- `rg -nP '(bg|text|border)-\[#|bg-white|bg-black|text-white|text-black' src/` returns no hits inside `src/routes/**` and `src/components/**` (allowed in `src/components/ui/**` shadcn primitives that already use tokens internally).
- No component file in `src/routes/_authenticated/**` exceeds 200 LOC.
- Build passes; sidebar navigation works; no route added/removed.
