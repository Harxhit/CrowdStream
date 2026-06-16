# Week 6 — Review & Retrospective

**Theme:** Recording & VOD pipeline.

## Did you complete this week?
- [ ] **Day 1** — Recording controller + PlainTransport consuming RTP (audio+video)
- [ ] **Day 2** — FFmpeg producing MP4 + HLS segments + thumbnails
- [ ] **Day 3** — S3 uploader (stream-as-written) + `recordings` doc lifecycle
- [ ] **Day 4** — CloudFront delivery; HLS playback in browser; S3 locked down
- [ ] **Day 5** — Full end-to-end recording test + failure path

## Deliverable verification
- [ ] Live stream produces a playable MP4 + HLS VOD
- [ ] Segments upload during the stream; scratch cleaned afterward
- [ ] `recordings` doc transitions recording → ready (failed on error)
- [ ] VOD plays via CloudFront; S3 not publicly accessible
- [ ] Recording isolated from SFU (no live-media degradation)

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
