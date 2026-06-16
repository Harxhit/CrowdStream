# Week 6 · Day 2 — FFmpeg: MP4 + HLS + Thumbnails

> Roadmap: [index](../../README.md) · [Week 6](../README.md)
> Refs: `docs/ARCHITECTURE.md` §9 (pipeline step 2)

## Goal
Pipe the RTP from Day 1 into FFmpeg and produce MP4 (archive), HLS/LL-HLS segments
(VOD playback), and periodic thumbnails.

## Why this matters
§9: FFmpeg muxes to MP4, segments to HLS (`.m3u8` + `.ts`), and extracts thumbnails.
HLS output is also the basis for the large-scale HLS hybrid (§15).

## Tasks
- [ ] Spawn FFmpeg with the Day 1 SDP as input (RTP ingest)
- [ ] Output **MP4** mux for archive/download
- [ ] Output **HLS / LL-HLS** (`.m3u8` + `.ts` segments) for VOD playback
- [ ] Extract **thumbnails** (`-vf fps=1/10` → every 10s + a poster frame)
- [ ] Write outputs to scratch (instance store / EFS); bound disk usage
- [ ] Handle FFmpeg lifecycle: start with recording, stop cleanly on stream end, capture errors

## Acceptance criteria
- [ ] A short test stream yields a valid playable MP4 and an HLS playlist + segments
- [ ] Thumbnails are generated at the configured interval
- [ ] FFmpeg exits cleanly on stop; failures are logged (not silent)

## Notes
> Segment as you go — don't wait for stream end (sets up streaming upload on Day 3).
