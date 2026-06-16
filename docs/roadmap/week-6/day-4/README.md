# Week 6 · Day 4 — CloudFront Delivery & Playback

> Roadmap: [index](../../README.md) · [Week 6](../README.md)
> Refs: `docs/ARCHITECTURE.md` §9, §14 (never serve VOD from EC2), §15

## Goal
Serve recordings through CloudFront and confirm HLS playback in the browser.

## Why this matters
§14: "Use CloudFront for all VOD; never serve recordings from EC2." Edge caching is
both a performance and a major cost lever (§14/§15).

## Tasks
- [ ] Create a CloudFront distribution in front of the recordings S3 bucket
- [ ] Lock down S3 (Origin Access Control); no public bucket access
- [ ] Expose `hlsPlaylistUrl` (CloudFront URL) on the `recordings` doc
- [ ] Add a VOD playback view in the frontend (HLS player, e.g. `hls.js`)
- [ ] Verify segments are cached at the edge (cache headers correct)
- [ ] Add signed URLs/cookies if recordings are private (optional for MVP)

## Acceptance criteria
- [ ] A recorded stream plays back via the CloudFront HLS URL in the browser
- [ ] S3 is not publicly accessible (only via CloudFront)
- [ ] Edge caching confirmed (cache hits on repeat segment fetches)

## Notes
> This HLS path is the seed of the large-scale "WebRTC + HLS hybrid" in §15.
