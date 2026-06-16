# Week 2 · Day 1 — Auth Service & User Model Design

> Roadmap: [index](../../README.md) · [Week 2](../README.md)
> Refs: `docs/ARCHITECTURE.md` §7 (users), §10

## Goal
Design and scaffold the authentication service: user model, password hashing, and
access/refresh token issuance.

## Why this matters
There is no `users` collection or auth path today. Everything in Week 2 depends on
having a token issuer and a verified identity.

## Tasks
- [ ] Create the `users` Mongoose model per `docs/ARCHITECTURE.md` §7 (username, email, passwordHash, roles, refreshTokenHash, banned)
- [ ] Add unique indexes on `email` and `username`
- [ ] Implement password hashing (argon2 or bcrypt) — never store plaintext
- [ ] Implement `POST /auth/register` and `POST /auth/login` REST endpoints (Express, `app.ts`)
- [ ] Issue a short-lived **access JWT (~15m)** and a **refresh token (~7d)** on login
- [ ] Add a JWT verify helper (`backend/src/auth/jwt.ts`) used by REST and signaling
- [ ] Store JWT signing secret in env/secrets (from Week 1 config loader)

## Acceptance criteria
- [ ] Register + login return an access token and refresh token
- [ ] Passwords are stored only as hashes
- [ ] An expired/invalid access token fails verification with a clear error

## Notes
> Roles array (`user`/`broadcaster`/`admin`/`moderator`) feeds authorization checks
> later (co-host approval, moderation in Week 5).
