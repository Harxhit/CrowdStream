# Week 6 — Review & Retrospective

**Theme:** Recording & VOD pipeline.

## Did you complete this week?
- [x] **Day 1** — Recording controller + PlainTransport consuming RTP (audio+video)
- [x] **Day 2** — FFmpeg producing MP4 + thumbnails
- [ ] **Day 3** — S3 uploader + `recordings` doc lifecycle
- [ ] **Day 4** — CloudFront delivery; HLS playback in browser; S3 locked down
- [x] **Day 5** — Full end-to-end recording test + failure path

## Deliverable verification
- [x] Live stream produces a playable MP4
- [ ] HLS VOD / segments upload during the stream
- [ ] `recordings` doc transitions recording → ready
- [ ] VOD plays via CloudFront; S3 not publicly accessible
- [x] Recording is isolated from SFU (no live-media degradation)

## Backlog (carry-over)

- [ ] **S3 recording storage** — Deferred because the current product downloads the completed MP4 directly to the user's device. **Future: Week 7+**
- [ ] **HLS / LL-HLS** — Not required for the current recording/download flow; no VOD segmented playback requirement. **Future: when VOD playback is introduced**
- [ ] **CloudFront delivery** — Depends on S3 + HLS/VOD infrastructure, so deferred with those features. **Future: when VOD is introduced**
- [ ] **`recordings` persistence model** — Not required while recordings are directly downloaded instead of persisted server-side. **Future: when persistent recordings are introduced**

- **Decisions/changes to the plan:**
  - Skipped HLS/LL-HLS because the current product only requires completed MP4 recordings.
  - Skipped S3 because persistent cloud storage is not currently required.
  - Skipped CloudFront because it depends on the deferred HLS/S3 VOD architecture.
  - Current recording flow is: **Record → FFmpeg → MP4 → browser download**.
