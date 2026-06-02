---
name: Firebase auth bypass pattern
description: How dev-bypass auth is implemented — backend and frontend — and how to re-enable real Firebase auth later.
---

# Firebase Auth Bypass Pattern

## The rule
When `FIREBASE_SERVICE_ACCOUNT_JSON` is absent (backend) or `VITE_FIREBASE_API_KEY` is absent (frontend), the app runs in dev-bypass mode with no authentication required. Setting both secrets re-enables full Firebase auth with zero code changes.

**Why:** Firebase keys were not available at project import time. User wanted the main app functionality to work immediately without being blocked on auth.

## How to apply

### Backend — `artifacts/api-server/src/lib/auth-middleware.ts`
- `getApps().length === 0` means Firebase Admin is not initialised (no `FIREBASE_SERVICE_ACCOUNT_JSON`)
- In that case: inject `req.user = { uid: "dev-bypass" }` and call `next()` — all `ownerUid`-scoped DB queries use the constant UID
- All existing businesses must be created with `ownerUid = "dev-bypass"` while in bypass mode

### Frontend — `artifacts/dashboard/src/contexts/AuthContext.tsx`
- `FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY`
- When false: `useState` initialised with a fake `DEV_USER` object, `loading` starts as `false`, `useEffect` no-ops
- `DEV_USER = { uid: "dev-bypass", displayName: "Dev User", email: "dev@localhost", photoURL: null }` cast as `User`
- No auth token getter is set → API client sends no `Authorization` header → backend bypass accepts it

### To re-enable real auth
1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` secret (server)
2. Set `VITE_FIREBASE_API_KEY` env var (frontend)
3. Restart both workflows — done
