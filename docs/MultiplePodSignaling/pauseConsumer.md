```txt
POD B (viewer socket lives here)                    POD A (owns the room/consumer)
────────────────────────────────────              ─────────────────────────────────

socket.on("pauseConsumer")
  │
  ├─ roomId received from client
  ├─ socketId = socket.id
  ├─ consumerId received from client
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │
  │    → Redis lookup fails?
  │         │
  │         ├─ ack({
  │         │    success: false,
  │         │    code: "PAUSE_CONSUMER_ERROR"
  │         │  })
  │         │
  │         └─ return
  │
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-pause-42"
  │
  ├─ Create payload:
  │
  │    {
  │      type: "pauseConsumer",
  │      requestId: "req-pause-42",
  │      args: {
  │        roomId,
  │        socketId,
  │        consumerId
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set("req-pause-42", {
  │     status: "pending",
  │     requestType: "pauseConsumer",
  │
  │     onComplete: (result, error) => {
  │
  │        clearTimeout(timeoutHandle)
  │
  │        if (error) {
  │           ack({
  │             success: false,
  │             code: "PAUSE_CONSUMER_ERROR"
  │           })
  │           return
  │        }
  │
  │        if (result.status === "completed") {
  │           ack({
  │             success: true,
  │             data: {
  │               consumerId
  │             }
  │           })
  │        }
  │     }
  │  })
  │        ▲
  │        │
  │        │ stored LOCALLY on Pod B
  │        │ never sent to Pod A
  │
  ├─ publishCommand(payload, "A")
  │
  │     spublish("pod:A:cmd", {
  │        type: "pauseConsumer",
  │        requestId: "req-pause-42",
  │        args: {
  │          roomId,
  │          socketId,
  │          consumerId
  │        },
  │        replyTo: "pod:B:response"
  │     })
  │
  │                    │
  │                    │ Redis
  │                    ▼
  │                                      podConnectionSubscriber
  │                                      receives "pod:A:cmd"
  │                                                │
  │                                                ▼
  │                                      handleIncomingRequest(payload)
  │                                                │
  │                                                ├─ type ===
  │                                                │  "pauseConsumer"
  │                                                │
  │                                                ├─ extract:
  │                                                │
  │                                                │  roomId
  │                                                │  socketId
  │                                                │  consumerId
  │                                                │
  │                                                ▼
  │                                      pauseConsumer(
  │                                        roomId,
  │                                        socketId,
  │                                        consumerId
  │                                      )
  │                                                │
  │                                                ▼
  │                                      Find viewer from
  │                                      Pod A's local room state
  │                                                │
  │                                                ▼
  │                                      Find consumer using
  │                                      consumerId
  │                                                │
  │                                                ▼
  │                                      consumer.pause()
  │                                                │
  │                                                ▼
  │                                      Consumer successfully
  │                                      paused on POD A
  │                                                │
  │                                                ▼
  │                                      result.status = "completed"
  │                                                │
  │                                                ▼
  │                                      publishResponse(
  │                                         {
  │                                           requestId:
  │                                             "req-pause-42",
  │                                           result: {
  │                                             status: "completed"
  │                                           }
  │                                         },
  │                                         "pod:B:response"
  │                                      )
  │
  │                    ▲
  │                    │ Redis
  │                    │
  └────────────────────┘
                       │
                       ▼

POD B
  │
  ├─ podConnectionSubscriber
  │    receives "pod:B:response"
  │
  ├─ handleIncomingResponse(payload)
  │
  ├─ entry =
  │    podRequestHandleMap.get("req-pause-42")
  │
  │    ↓
  │    finds the SAME local entry
  │
  ├─ entry.status = "resolved"
  │
  ├─ entry.onComplete(
  │      payload.result,
  │      payload.error
  │   )
  │
  │    ↓
  │
  │    ├─ clearTimeout(timeoutHandle)
  │    │
  │    ├─ if error
  │    │     │
  │    │     └─ ack({
  │    │          success: false,
  │    │          code: "PAUSE_CONSUMER_ERROR"
  │    │        })
  │    │
  │    └─ if result.status === "completed"
  │          │
  │          └─ ack({
  │               success: true,
  │               data: {
  │                 consumerId
  │               }
  │             })
  │
  └─ podRequestHandleMap.delete("req-pause-42")
```