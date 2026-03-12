# Souscription Platform — Claude Code Instructions

## What is this project?

A subscription flow frontend for Anaxago investors. Users go through a guided journey to subscribe to financial products (real estate, private equity, etc.). This app consumes the **Platform API** — it has no backend of its own.

## Tech Stack

- **Framework**: React Router v7 (SSR mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Deployment**: Vercel (auto-deploy on push to main)
- **Package manager**: pnpm
- **Node**: 24 LTS

## API Reference

The full Platform API spec lives at: **`docs/platform-api.openapi.json`** (OpenAPI 3.0, ~20k lines).

- **Test environment**: `https://cif-test.anaxago.com/api`
- **Local dev**: `http://localhost:3000/api`
- **Swagger UI** (when running locally): `http://localhost:3000/api`

**Always read `docs/platform-api.openapi.json` before building any feature** — it is the single source of truth for request/response shapes, required fields, and available endpoints.

## Key API Domains

### Persons (user creation — hello world feature)
- `POST /api/persons` — create a person (firstName, lastName, email, phone, birthDate, nationality, birthCountry)
- `GET /api/persons` — list persons
- `GET /api/persons/{id}` — get a person
- `PATCH /api/persons/{id}/identity` — update identity
- `PATCH /api/persons/{id}/address` — update address
- `PATCH /api/persons/{id}/tax-residence` — update tax residence

### Accounts
- `POST /api/accounts` — create an account (links to a person)
- `GET /api/accounts/{id}` — get account details
- Lifecycle: suspend, reactivate, close

### Individual Investors
- `POST /api/individual-investors` — create investor (links to account + person)
- Profile assessment, sources of wealth, lifecycle management

### Subscription Journeys (main feature)
- `POST /api/subscription-journeys` — start a journey (needs templateId + investorId + marketingProductId)
- `GET /api/subscription-journeys/{id}` — get journey with all steps
- `GET /api/subscription-journeys/{id}/overview` — lightweight overview
- Step navigation: complete, skip, navigate
- Basket management: add/update/remove lines, set envelope target, answer product questions
- Document upload per step
- Adequacy evaluation per step

### Subscription Journey Templates
- `GET /api/subscription-journey-templates` — list available templates
- Templates define the steps an investor walks through

### Marketing Products
- `GET /api/marketing-products` — list products available for subscription
- `GET /api/marketing-products/by-slug/{slug}` — get by URL slug

### Investor Assessments (KYC/suitability)
- Start session → answer questions → validate
- `GET /api/investor-assessments/by-investor/{investorId}` — get investor's assessment

### Subscription Orders (post-journey)
- `POST /api/subscription-orders` — create order from journey
- Reserve → sign → pay → approve/reject → confirm

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm typecheck` — type generation + tsc
- `pnpm start` — serve production build

## Project Structure

```
app/
  routes/          # Route modules (file-based routing)
  components/      # Shared UI components
  lib/             # Utilities, API client, types
docs/
  platform-api.openapi.json   # Full API spec — READ THIS FIRST
```

## Development Rules

- **API spec is the source of truth** — always check `docs/platform-api.openapi.json` for exact field names, types, and required/optional status before writing any API call
- **No hardcoded API URLs** — use environment variables (`VITE_API_BASE_URL` or similar)
- **TypeScript strict mode** — no `any`, explicit return types
- **Respond in French** — the UI is in French, user-facing strings should be in French
