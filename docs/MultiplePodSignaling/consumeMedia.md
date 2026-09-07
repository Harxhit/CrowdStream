```txt
POD B (viewer socket lives here)                    POD A (owns the room/router/transports)
────────────────────────────────────              ──────────────────────────────────────────

socket.on("consume")
  │
  ├─ roomId received from client
  ├─ socketId = socket.id
  ├─ rtpCapabilities received from client
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-consume-42"
  │
  ├─ Create payload:
  │
  │    {
  │      type: "consume",
  │      requestId: "req-consume-42",
  │      args: {
  │        roomId,
  │        socketId,
  │        rtpCapabilities
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set("req-consume-42", {
  │     status: "pending",
  │     requestType: "consume",
  │
  │     onComplete: (result, error) => {
  │
  │        if (error) {
  │           ack({
  │             success: false,
  │             code: "CONSUME_ERROR"
  │           })
  │           return
  │        }
  │
  │        clearTimeout(timeoutHandle)
  │
  │        ack({
  │          success: true,
  │          data: result
  │        })
  │
  │        Viewer.updateOne(...)
  │        → store consumer IDs in database
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
  │        type: "consume",
  │        requestId: "req-consume-42",
  │        args: {
  │          roomId,
  │          socketId,
  │          rtpCapabilities
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
  │                                                ├─ type === "consume"
  │                                                │
  │                                                ├─ extract:
  │                                                │
  │                                                │  roomId
  │                                                │  socketId
  │                                                │  rtpCapabilities
  │                                                │
  │                                                ▼
  │                                      consume(
  │                                        roomId,
  │                                        socketId,
  │                                        rtpCapabilities,
  │                                        "consumer"
  │                                      )
  │                                                │
  │                                                ▼
  │                                      Find viewer from
  │                                      Pod A's local room state
  │                                                │
  │                                                ▼
  │                                      Find viewer's connected
  │                                      consumer transport
  │                                                │
  │                                                ▼
  │                                      Loop through broadcasters
  │                                      and their producers
  │                                                │
  │                                                ├─ canConsume(...)
  │                                                │
  │                                                ├─ transport.consume(...)
  │                                                │
  │                                                ├─ store Consumer
  │                                                │  in viewer.consumers
  │                                                │
  │                                                ▼
  │                                      Build consumerParams:
  │
  │                                      {
  │                                        consumerParams: [
  │                                          {
  │                                            id,
  │                                            producerId,
  │                                            kind,
  │                                            rtpParameters
  │                                          }
  │                                        ]
  │                                      }
  │                                                │
  │                                                ▼
  │                                      result = consumerParams
  │                                                │
  │                                                ▼
  │                                      publishResponse(
  │                                         {
  │                                           requestId:
  │                                             "req-consume-42",
  │                                           result
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
  │    podRequestHandleMap.get("req-consume-42")
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
  │    ├─ if error
  │    │     │
  │    │     └─ ack({
  │    │          success: false,
  │    │          code: "CONSUME_ERROR"
  │    │        })
  │    │
  │    ├─ clearTimeout(timeoutHandle)
  │    │
  │    ├─ ack({
  │    │     success: true,
  │    │     data: result
  │    │   })
  │    │
  │    └─ Viewer.updateOne(...)
  │         │
  │         └─ store returned consumer IDs
  │            in database
  │
  └─ podRequestHandleMap.delete("req-consume-42")
```