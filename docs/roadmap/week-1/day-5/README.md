# Week 1 · Day 5 — Integration Test & Weekly Review

> Roadmap: [index](../../README.md) · [Week 1](../README.md)

## Goal
Prove the full NAT-traversal path works across realistic network conditions, then
run the [weekly review](../review.md).

## Tasks
- [ ] Two-device test: broadcaster and viewer on **different networks** (e.g. laptop on Wi‑Fi, phone on cellular)
- [ ] Repeat with one peer behind a restrictive/UDP-blocked network
- [ ] Confirm no hardcoded IPs remain (`grep` clean from Day 1)
- [ ] Confirm CORS allowlist rejects an unknown origin
- [ ] Capture `webrtc-internals` evidence (candidate types used) and note in the review
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Cross-network broadcast→view works (direct *and* relay)
- [ ] Week 1 review completed; backlog captured

## Then
Open the [Week 1 review](../review.md).
