# Week 6 · Day 1 — Recording Controller & PlainTransport

> Roadmap: [index](../../README.md) · [Week 6](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4e, §9 (pipeline step 1)

## Goal
Spawn a recording worker per stream that consumes the broadcaster's audio+video via
a MediaSoup `PlainTransport` (RTP, no DTLS).

## Why this matters
§9: the controller creates a `PlainTransport` on the router and `consume`s the
producers as raw RTP — this is server-internal, so no WebRTC/DTLS handshake is
needed. This RTP is what feeds FFmpeg on Day 2.

## Tasks
- [ ] Add a Recording Controller module that starts/stops recording for a room
- [ ] On start: `router.createPlainTransport(...)` for audio and video
- [ ] `consume` the broadcaster's audio + video producers onto the plain transport(s)
- [ ] Generate the SDP describing the RTP streams (codecs/payload types/ports) for FFmpeg
- [ ] Run recording workers on isolated compute (don't starve live SFU — §9 placement note)
- [ ] Add a `startRecording` / `stopRecording` trigger (API or auto-on-stream-start)

## Acceptance criteria
- [ ] A PlainTransport receives RTP for both audio and video of a live stream
- [ ] A valid SDP is produced for the consumed streams
- [ ] Recording start/stop is controllable per stream

## Notes
> Keep recording workers off the SFU nodes — FFmpeg is CPU/disk heavy (§9).
