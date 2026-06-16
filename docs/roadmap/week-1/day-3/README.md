# Week 1 · Day 3 — Deploy Coturn (STUN + TURN)

> Roadmap: [index](../../README.md) · [Week 1](../README.md)
> Refs: `docs/ARCHITECTURE.md` §3, §5 (networking), §10 (TURN creds), §16

## Goal
Stand up a working Coturn server providing STUN and TURN relay so clients behind
symmetric NAT can connect.

## Why this matters
This is the **#1 blocker** in `docs/ARCHITECTURE.md` §0. Without a relay, clients
on symmetric NATs (common on mobile/corporate networks) cannot establish media.

## Tasks
- [ ] Provision an instance with a **public/Elastic IP** for Coturn (EC2 in public subnet per §5)
- [ ] Install and configure `coturn`: `listening-port=3478`, TLS on `5349`, `fingerprint`, `realm`
- [ ] Enable **`use-auth-secret`** with a static secret (we issue time-limited HMAC creds in Week 2 Day 4)
- [ ] Restrict the relay UDP/TCP port range and open it in the security group / firewall
- [ ] Verify STUN: `turnutils_stunclient <coturn-ip>` returns a mapped address
- [ ] Verify TURN allocation with `turnutils_uclient` using a test credential
- [ ] Record the Coturn host/secret in your secrets store (not in git)

## Acceptance criteria
- [ ] STUN binding request returns the server's reflexive mapping
- [ ] A TURN allocation succeeds with a valid credential and fails with an invalid one
- [ ] Coturn survives a reboot (enabled as a service)

## Notes
> Coturn must sit behind an **NLB** (UDP/TCP), not an ALB — ALB can't do UDP (§5).
> For local/dev you can run Coturn in Docker; for staging use the EC2 + EIP shape.
