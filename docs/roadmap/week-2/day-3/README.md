# Week 2 · Day 3 — Refresh Token Rotation

> Roadmap: [index](../../README.md) · [Week 2](../README.md)
> Refs: `docs/ARCHITECTURE.md` §10 (auth), §16 (Security)

## Goal
Implement rotating, hashed refresh tokens so access tokens can stay short-lived
without forcing users to re-login.

## Why this matters
Short access tokens (15m) need a refresh mechanism. Storing refresh tokens hashed
and rotating them on use limits the blast radius of a leaked token.

## Tasks
- [ ] `POST /auth/refresh` endpoint: validate refresh token against `refreshTokenHash` in `users`
- [ ] On refresh, **rotate**: issue a new refresh token, store its hash, invalidate the old one
- [ ] Detect reuse of an already-rotated token → revoke the session (possible theft)
- [ ] `POST /auth/logout`: clear the stored refresh hash
- [ ] Store refresh token client-side securely (httpOnly cookie preferred over localStorage)
- [ ] Add expiry (~7d) and include it in the stored record

## Acceptance criteria
- [ ] Refresh returns a new access + new refresh token; old refresh token no longer works
- [ ] Reusing a rotated refresh token revokes the session
- [ ] Logout invalidates refresh ability

## Notes
> Refresh tokens are stored **hashed** in `users.refreshTokenHash`, never in plaintext.
