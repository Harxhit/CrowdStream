```text
POD B (viewer socket lives here)                    POD A (owns the room)
────────────────────────────────────              ─────────────────────────

socket.on("viewer:heartBeat")
  │
  ├─ roomId = socket.data.roomId
  ├─ socketId = socket.id
  │
  ├─ getRedisRoom(roomKey)
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-hb-42"
  │
  ├─ podRequestHandleMap.set("req-hb-42", {
  │     status: 'pending',
  │     requestType: 'heartBeat',
  │     onComplete: (result, error) => {
  │        if (error) {
  │           // heartbeat failed
  │           return
  │        }
  │
  │        if (result.status === 'completed') {
  │           // heartbeat successfully completed on Pod A
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
  │        type: "heartBeat",
  │        requestId: "req-hb-42",
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
  │                                                ├─ type === "heartBeat"
  │                                                │
  │                                                ├─ getRoom(roomId)
  │                                                │    ↓
  │                                                │  local room
  │                                                │
  │                                                ├─ verify viewer exists
  │                                                │
  │                                                ├─ await heartBeat(
  │                                                │      roomId,
  │                                                │      socketId
  │                                                │   )
  │                                                │
  │                                                │   heartbeat updates
  │                                                │   viewer on Pod A
  │                                                │
  │                                                └─ result = {
  │                                                     status: "completed"
  │                                                   }
  │
  │                                      publishResponse(
  │                                         {
  │                                           requestId: "req-hb-42",
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
  │    podRequestHandleMap.get("req-hb-42")
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
  │    if result.status === "completed"
  │       → heartbeat succeeded
  │
  └─ podRequestHandleMap.delete("req-hb-42")
```
