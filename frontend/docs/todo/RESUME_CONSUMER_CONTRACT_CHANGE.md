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

