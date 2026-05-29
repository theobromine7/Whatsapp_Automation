# NexusAgent — WhatsApp AI Sales Agent Platform

A multi-tenant SaaS platform where any business can register their WhatsApp Business number and get an AI-powered sales agent powered by Gemini.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path /api)
- `pnpm --filter @workspace/dashboard run dev` — run the frontend dashboard (port 23183, path /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — auto-set by Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Gemini via Replit AI Integrations (`@workspace/integrations-gemini-ai`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, TanStack Query, wouter, shadcn/ui, Tailwind CSS

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (businesses, whatsapp-conversations, whatsapp-messages)
- `lib/integrations-gemini-ai/` — Gemini AI client and utilities
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/agent.ts` — Gemini AI response generation logic
- `artifacts/api-server/src/lib/whatsapp.ts` — WhatsApp Cloud API sender
- `artifacts/dashboard/src/` — React frontend

## Architecture decisions

- **Multi-tenant by phone number ID**: Incoming WhatsApp webhooks are routed to the correct business by matching `phone_number_id` from Meta's payload against the registered `whatsappPhoneNumberId` in the DB.
- **Single webhook endpoint**: All businesses share `/api/whatsapp/webhook`. Meta sends the phone_number_id in every payload, so routing is automatic.
- **Verification token per business**: Each business has its own `webhookVerifyToken` for Meta's webhook verification handshake (GET request).
- **Gemini `gemini-3-flash-preview`**: Used for AI response generation — fast and cost-efficient for high-volume chat.
- **Conversation continuity**: Full conversation history is loaded from DB on each message, passed to Gemini as context.

## Product

- **Dashboard** — platform stats (total businesses, conversations, messages, today's activity)
- **Business Registration** — 3-step form: Business Info → WhatsApp Meta credentials → AI Config (system prompt, products, FAQs)
- **Business Detail** — per-business stats, conversation list, bot toggle, webhook URL/token display
- **Conversation View** — full chat thread between customer and AI agent

## How to connect a business WhatsApp number

1. Register your business in the dashboard (Add Business)
2. In Meta Developer Console → WhatsApp → Configuration, set:
   - Webhook URL: `https://your-domain.replit.app/api/whatsapp/webhook`
   - Verify Token: the `webhookVerifyToken` shown in the dashboard
3. Subscribe to the `messages` webhook field
4. Your AI bot is live!

## User preferences

- Use Gemini AI (not OpenAI or Anthropic)
- General-purpose multi-tenant tool (not single-business)

## Gotchas

- `@google/genai` must NOT be in the esbuild externals list — it must be bundled into the server output
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes
- The Gemini client throws at startup if `AI_INTEGRATIONS_GEMINI_BASE_URL` or `AI_INTEGRATIONS_GEMINI_API_KEY` are missing

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `ai-integrations-gemini` skill for Gemini integration details
