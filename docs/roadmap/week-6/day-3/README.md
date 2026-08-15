# Week 6 · Day 3 --- Recording Download

> Roadmap: [index](../../README.md) · [Week 6](../README.md) Refs:
> `docs/ARCHITECTURE.md` §9

## Goal

Finish the recording as an MP4 when the user stops recording and allow
the browser to download the completed recording directly to the user's
device.

The current product does not require persistent cloud storage, HLS/VOD
delivery, or a recordings database. Those can be introduced later if the
product requires persistent recording storage or VOD playback.

## Flow

```text
User clicks Stop
      ↓
FFmpeg finishes MP4
      ↓
Backend exposes completed MP4
      ↓
Browser downloads MP4
      ↓
Recording is saved on user's device
```

## Tasks

* [ ] Stop FFmpeg gracefully when the user stops recording
* [ ] Wait for FFmpeg to finish writing the MP4
* [ ] Expose the completed MP4 from the backend
* [ ] Trigger the browser download from the viewer
* [ ] Clean up recording consumers, transports, UDP ports, and
  temporary files
* [ ] Handle recording/download failures and log errors

## Acceptance criteria

* [ ] Stopping a recording produces a complete, playable MP4
* [ ] The backend can expose the completed MP4
* [ ] The viewer browser downloads the MP4 successfully
* [ ] Recording resources are cleaned up after recording finishes
* [ ] Failures are logged and do not leave recording resources behind

## Deferred

The following are intentionally deferred because they are not required
by the current product flow:

* S3/cloud storage
* HLS / LL-HLS
* `.m3u8` and `.ts` segment uploading
* `recordings` collection for persistent cloud recordings
* VOD playback infrastructure
* S3 versioning and Glacier lifecycle policies

These can be added later if persistent cloud storage or VOD playback
becomes a product requirement.
