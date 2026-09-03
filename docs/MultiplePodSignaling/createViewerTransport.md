```text
POD B (viewer socket lives here)                    POD A (owns the room/router)
────────────────────────────────────              ─────────────────────────────

socket.on("createViewerTransport")
  │
  ├─ roomId received from client
  ├─ socketId = socket.id
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-transport-42"
  │
  ├─ Create payload:
  │
  │    {
  │      type: "createViewerTransport",
  │      requestId: "req-transport-42",
  │      args: {
  │        roomId,
  │        socketId
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set("req-transport-42", {
  │     status: "pending",
  │     requestType: "createViewerTransport",
  │
  │     onComplete: (result, error) => {
  │
  │        clearTimeout(timeoutHandle)
  │
  │        if (error) {
  │           ack({
  │             success: false,
  │             code: "TRANSPORT_CREATION_FAILED"
  │           })
  │           return
  │        }
  │
  │        ack({
  │          success: true,
  │          data: result
  │        })
  │
  │        Viewer.findOneAndUpdate(...)
  │        → store transportId in database
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
  │        type: "createViewerTransport",
  │        requestId: "req-transport-42",
  │        args: {
  │           roomId,
  │           socketId
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
  │                                                │  "createViewerTransport"
  │                                                │
  │                                                ├─ getRoom(roomId)
  │                                                │    ↓
  │                                                │  local room on Pod A
  │                                                │
  │                                                ├─ verify viewer exists
  │                                                │
  │                                                ├─ room.viewers.get(socketId)
  │                                                │
  │                                                ▼
  │                                      createConsumerTransport(
  │                                          roomId,
  │                                          socketId
  │                                      )
  │                                                │
  │                                                │
  │                                                ▼
  │                                      Mediasoup creates transport
  │                                      on POD A
  │                                                │
  │                                                ▼
  │                                      result = {
  │                                        id,
  │                                        iceParameters,
  │                                        iceCandidates,
  │                                        dtlsParameters
  │                                      }
  │                                                │
  │                                                ▼
  │                                      publishResponse(
  │                                         {
  │                                           requestId:
  │                                             "req-transport-42",
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
  │    podRequestHandleMap.get("req-transport-42")
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
  │    ├─ ack({
  │    │     success: true,
  │    │     data: {
  │    │       id,
  │    │       iceParameters,
  │    │       iceCandidates,
  │    │       dtlsParameters
  │    │     }
  │    │   })
  │    │
  │    └─ Store transportId in Viewer database
  │
  └─ podRequestHandleMap.delete("req-transport-42")
```