# Week 1 · Day 2 — Enable TCP Fallback in Transports

> Roadmap: [index](../../README.md) · [Week 1](../README.md)
> Refs: `docs/ARCHITECTURE.md` §3 (ICE config), §16 (Blockers) · `ARCHITECTURE.md` §3.2

## Goal
Allow ICE to fall back to TCP for clients on networks that block UDP.

## Why this matters
`transport.ts` currently creates WebRtcTransports with TCP disabled. Many
corporate/guest networks block UDP entirely; without TCP fallback those viewers
silently fail to connect.

## Tasks
- [ ] In `backend/src/mediasoup/transport.ts` set `enableUdp: true`, `enableTcp: true`, `preferUdp: true`
- [ ] Set a sane `initialAvailableOutgoingBitrate` (e.g. `1_000_000`)
- [ ] Confirm `listenIps` uses `{ ip: "0.0.0.0", announcedIp: config.announcedIp }`
- [ ] Verify the host/security group allows the TCP RTC port range as well as UDP
- [ ] Add a short log line on transport creation showing enabled protocols

## Acceptance criteria
- [ ] A transport created on the server reports both UDP and TCP ICE candidates
- [ ] Forcing UDP-blocked conditions (firewall rule or `iceTransportPolicy` test) still connects via TCP/TURN
- [ ] No regression: normal UDP path still negotiates and prefers UDP

## Reference snippet (`docs/ARCHITECTURE.md` §3)
```ts
const transport = await router.createWebRtcTransport({
  listenIps: [{ ip: "0.0.0.0", announcedIp: process.env.ANNOUNCED_IP }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1_000_000,
});
```
