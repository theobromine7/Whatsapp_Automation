---
name: Baileys session restart bug
description: Why QR/pairing connections failed immediately and how the session manager must be structured to avoid it.
---

## The rule
`startSession()` must NEVER call `stopSession()` or `logout()` internally. It must call `closeSocketOnly()` instead.

**Why:** `logout()` sends a logout command to WhatsApp servers, which fires a `connection.update` event with `loggedOut=true`. The `loggedOut=true` handler deletes session credential files. So every internal restart wiped the just-scanned QR credentials before the new socket could use them.

**How to apply:** Keep two separate close paths:
- `closeSocketOnly(businessId)` — ends the WS (no logout), deletes in-memory entry, preserves session files. Used by `startSession()` at the top.
- `stopSession(businessId)` — calls `logout()` + deletes session files + closes SSE clients. Used ONLY by user-initiated disconnect routes.

## Error 515 (restartRequired)
WhatsApp sends stream error code 515 to tell the client to reconnect — it is NOT a credential failure and must NOT count toward `connectAttempts`. Treat it the same as a dropped live session: reconnect after a short delay, keep credentials intact.

```
const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
```

## Stale socket guard
Old socket event handlers fire after `closeSocketOnly` replaces the session. Guard every `connection.update` handler with:
```javascript
if (sessions.get(businessId) !== entry) return;
```
This prevents a replaced socket's events from interfering with the new session.

## connectAttempts
Only increment for genuine auth errors (403, 400), NOT for transient drops or 515. Reset to 0 on `connection === "open"`.
