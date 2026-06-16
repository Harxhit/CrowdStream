# Week 1 · Day 1 — Externalize Configuration & Secrets

> Roadmap: [index](../../README.md) · [Week 1](../README.md)
> Refs: `docs/ARCHITECTURE.md` §10, §16 (Blockers) · `ARCHITECTURE.md` §3.2, §6

## Goal
Remove every hardcoded IP, port, and origin from the codebase and drive them from
environment variables with validation at boot.

## Why this matters
The public IP `13.232.120.1` is hardcoded in `backend/src/mediasoup/transport.ts`
and the Coturn IP `65.0.239.130` + server URL `http://13.232.120.1:3000` are
hardcoded on the frontend. This couples the app to one EC2 box and blocks
horizontal/multi-region scaling.

## Tasks
- [ ] Audit all hardcoded values: `grep -rn "13.232.120.1\|65.0.239.130\|3000" backend/src frontend/src`
- [ ] Add to backend `.env` / `.env.example`: `ANNOUNCED_IP`, `RTC_MIN_PORT`, `RTC_MAX_PORT`, `CORS_ORIGINS`, `PORT`
- [ ] Add a typed config loader (e.g. `backend/src/config/index.ts`) that reads + **validates** env at startup and fails fast if missing
- [ ] Replace `announcedIp: '13.232.120.1'` in `transport.ts` with `config.announcedIp`
- [ ] Replace the RTC port range in `worker.ts` with `config.rtcMinPort` / `config.rtcMaxPort`
- [ ] Replace Socket.IO `origin: "*"` in `utils/socket.util.ts` with `config.corsOrigins` (comma-split allowlist)
- [ ] Frontend: move the server URL in `socket.ts` and the Coturn URLs in `room.ts` into Vite env vars (`VITE_SIGNALING_URL`, `VITE_TURN_URL`, etc.)
- [ ] Document every variable in `backend/README.md` and `frontend/README.md`

## Acceptance criteria
- [ ] `grep` for the two IPs returns **zero** matches in `src/`
- [ ] Backend refuses to boot with a clear error if a required env var is missing
- [ ] App still runs end-to-end locally using `.env` values only

## Notes
> Keep secrets out of git. `.env` is already gitignored — verify, and commit only `.env.example`.
