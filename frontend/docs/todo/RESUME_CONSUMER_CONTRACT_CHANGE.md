# Resume Consumer Contract Change

## Overview

Consumer lifecycle control has been updated in:

```txt
backend/src/consumer/consumer.handler.ts
```

The backend now follows **consumer-level control** instead of broad viewer-level resume behavior.

This change aligns:

* `pauseConsumer`
* `resumeConsumer`
* `closeConsumer`

under a consistent Mediasoup consumer contract.

---

## Previous Behavior

`resumeConsumer` resumed **all viewer consumers** and only required:

```ts
{ roomId }
```

Frontend:

```ts
socket.emit("resumeConsumer", {
  roomId
});
```

This created an API mismatch because:

* `pauseConsumer` required `consumerId`
* backend helper expected consumer-specific behavior
* frontend and socket listener used resume-all behavior

---

## Updated Consumer Contract

All consumer lifecycle events are now **consumer specific**.

Frontend must provide:

```ts
consumerId
```

for pause, resume, and close operations.

### Pause Consumer

```ts
socket.emit("pauseConsumer", {
  roomId,
  consumerId
});
```

### Resume Consumer

```ts
socket.emit("resumeConsumer", {
  roomId,
  consumerId
});
```

### Close Consumer

```ts
socket.emit("closeConsumer", {
  roomId,
  consumerId
});
```

---

## Why This Change

### 1. API Consistency

All consumer handlers now follow the same contract:

```txt
(roomId, socketId, consumerId)
```

instead of mixing single-consumer and resume-all behavior.

---

### 2. Better Mediasoup Alignment

Mediasoup operates at the **Consumer level**.

A viewer may have multiple consumers:

* camera
* microphone
* screenshare
* co-host streams
* additional media producers

Consumer-level control matches Mediasoup design more accurately.

---

### 3. Improved Control

Resume-all behavior could unintentionally resume:

* paused microphone
* paused camera
* paused screenshare

Specific `consumerId` control prevents unintended media state changes.

---

## Frontend Action Required

Update all `resumeConsumer` socket emits and related listener logic to include:

```ts
consumerId
```

before frontend testing or integration.

---

## Security / Reliability Notes

This change does **not directly increase security**.

However, it improves:

* API correctness
* predictable media lifecycle control
* reduced unintended state changes
* clearer backend/frontend contracts
* easier debugging and maintenance
