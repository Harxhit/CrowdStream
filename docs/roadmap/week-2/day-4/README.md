# Week 2 · Day 4 — Time-Limited HMAC TURN Credentials

> Roadmap: [index](../../README.md) · [Week 2](../README.md)
> Refs: `docs/ARCHITECTURE.md` §10 (TURN credentials) · Week 1 Day 3 (Coturn)

## Goal
Replace static TURN passwords with short-lived HMAC credentials issued per session.

## Why this matters
Day 3 of Week 1 enabled Coturn with `use-auth-secret`. Shipping a static TURN
password to clients is a leak risk; time-limited HMAC creds expire automatically.

## Tasks
- [ ] Add a **TURN credential endpoint/event** that returns `{ username, credential, urls, ttl }`
- [ ] Compute `username = expiryTs:userId`, `credential = base64(HMAC-SHA1(coturnSecret, username))`
- [ ] Set a short TTL (e.g. 5–10 min); credentials regenerate on each session start
- [ ] Require a valid access JWT to obtain TURN credentials (ties into Day 2)
- [ ] Frontend: fetch these creds and feed them into `iceServers` (replacing static creds from Week 1 Day 4)
- [ ] Verify Coturn accepts the HMAC cred and rejects an expired one

## Acceptance criteria
- [ ] A fresh HMAC credential authenticates against Coturn
- [ ] An expired credential is rejected by Coturn
- [ ] No static TURN password exists anywhere in client code

## Notes
> The `coturnSecret` matches the `use-auth-secret` configured on Coturn (Week 1 Day 3).
