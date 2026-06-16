# Week 6 · Day 5 — End-to-End Recording Test & Weekly Review

> Roadmap: [index](../../README.md) · [Week 6](../README.md)

## Goal
Validate the full record→store→serve pipeline, then run the [weekly review](../review.md).

## Tasks
- [ ] Run a full live stream start→finish with recording enabled
- [ ] Confirm MP4 + HLS playlist + segments + thumbnails all in S3
- [ ] Confirm `recordings` doc is `ready` with correct URLs, duration, size
- [ ] Play the VOD back via CloudFront end to end
- [ ] Test failure handling: kill FFmpeg mid-record → doc marked `failed`, scratch cleaned
- [ ] Confirm recording workers ran isolated from SFU (no live-media impact)
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Full pipeline produces a playable VOD
- [ ] Failure path is handled cleanly
- [ ] Week 6 review completed; backlog captured

## Then
Open the [Week 6 review](../review.md).
