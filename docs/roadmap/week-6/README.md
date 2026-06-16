# Week 6 — Recording & VOD Pipeline

**Theme:** Capture live streams to durable VOD: MediaSoup → FFmpeg → S3 → CloudFront,
with HLS playback and thumbnails.

**Why now:** `docs/ARCHITECTURE.md` §0 lists recording as "None (FFmpeg not
integrated)." §9 defines the pipeline. This is also the foundation for the HLS
hybrid delivery that makes large scale affordable (§6/§15).

## Days
- [Day 1 — Recording controller & PlainTransport](day-1/)
- [Day 2 — FFmpeg: MP4 + HLS + thumbnails](day-2/)
- [Day 3 — S3 uploader & recordings collection](day-3/)
- [Day 4 — CloudFront delivery & playback](day-4/)
- [Day 5 — End-to-end recording test & weekly review](day-5/)

## Week goal
A finished live stream produces a playable HLS VOD (and MP4) on S3, served via
CloudFront, with thumbnails and a `recordings` doc marked `ready`.

## Reference
- `docs/ARCHITECTURE.md` §4e (flow), §7 (recordings), §9 (pipeline), §14 (cost), §15 (HLS hybrid)
