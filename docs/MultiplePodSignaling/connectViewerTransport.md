```text
POD B (viewer socket lives here)                    POD A (owns the room/router/transport)
────────────────────────────────────              ────────────────────────────────────────

socket.on("connectConsumerTransport")
  │
  ├─ roomId = socket.data.roomId
  ├─ socketId = socket.id
  ├─ dtlsParameters = payload.dtlsParameters
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-connect-42"
  │
  ├─ Create payload:
  │
  │    {
  │      type: "connectViewerTransport",
  │      requestId: "req-connect-42",
  │      args: {
  │        roomId,
  │        socketId,
  │        dtlsParameters
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set("req-connect-42", {
  │     status: "pending",
  │     requestType: "connectViewerTransport",
  │
  │     onComplete: (result, error) => {
  │
  │        clearTimeout(timeoutHandle)
  │
  │        if (error) {
  │           ack({
  │             success: false,
  │             code: "TRANSPORT_CONNECTION_FAILED"
  │           })
  │           return
  │        }
  │
  │        if (result.status === "completed") {
  │           ack({
  │             success: true
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
  │        type: "connectViewerTransport",
  │        requestId: "req-connect-42",
  │        args: {
  │          roomId,
  │          socketId,
  │          dtlsParameters
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
  │                                                │  "connectViewerTransport"
  │                                                │
  │                                                ├─ extract:
  │                                                │
  │                                                │  roomId
  │                                                │  socketId
  │                                                │  dtlsParameters
  │                                                │
  │                                                ▼
  │                                      connectConsumerTransport(
  │                                          roomId,
  │                                          socketId,
  │                                          dtlsParameters
  │                                      )
  │                                                │
  │                                                ▼
  │                                      Find consumer transport
  │                                      from Pod A's local room state
  │                                                │
  │                                                ▼
  │                                      transport.connect({
  │                                        dtlsParameters
  │                                      })
  │                                                │
  │                                                ▼
  │                                      Consumer transport successfully
  │                                      connected on POD A
  │                                                │
  │                                                ▼
  │                                      result = {
  │                                        status: "completed"
  │                                      }
  │                                                │
  │                                                ▼
  │                                      publishResponse(
  │                                         {
  │                                           requestId:
  │                                             "req-connect-42",
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
  │    podRequestHandleMap.get("req-connect-42")
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
  │    │          code: "TRANSPORT_CONNECTION_FAILED"
  │    │        })
  │    │
  │    └─ if result.status === "completed"
  │          │
  │          └─ ack({
  │               success: true
  │             })
  │
  └─ podRequestHandleMap.delete("req-connect-42")
```