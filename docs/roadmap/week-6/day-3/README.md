# Week 6 · Day 3 — S3 Uploader & recordings Collection

> Roadmap: [index](../../README.md) · [Week 6](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4e, §7 (recordings), §9 (steps 3–4)

## Goal
Stream HLS segments to S3 as they're written, finalize the playlist, and track
status in a `recordings` doc.

## Why this matters
§9: upload segments to S3 as written (don't wait for stream end); write the playlist
last; on finish mark the recording `ready`. §7 defines the `recordings` schema.

## Tasks
- [ ] Create the `recordings` model per §7 (`streamId`, `status`, `s3Key`, `hlsPlaylistUrl`, `mp4Url`, `thumbnailUrls`, `durationSec`, `sizeBytes`)
- [ ] On recording start: insert `recordings` doc with `status: "recording"`
- [ ] Uploader watches scratch and streams `.ts` segments + thumbnails to S3 as written
- [ ] Upload the `.m3u8` playlist and MP4 last; then upload-and-delete scratch to bound disk
- [ ] On finish: set `status: "ready"`, fill URLs, `durationSec`, `sizeBytes`, `readyAt`
- [ ] On failure: set `status: "failed"` with error context

## Acceptance criteria
- [ ] Segments appear in S3 during (not only after) the stream
- [ ] Playlist + MP4 + thumbnails land in S3; scratch is cleaned up
- [ ] `recordings` doc transitions recording → ready (or failed) correctly

## Notes
> Use S3 versioning + lifecycle to Glacier for cost (ties to §13 DR / §14 cost).
