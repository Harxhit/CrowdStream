```text
POD B (viewer's socket lives here)                    POD A (owns the room)
────────────────────────────────────                  ──────────────────────

socket.on("joinRoom")
  │
  ├─ getRedisRoom(roomKey)
  │  → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-9f2"
  │
  ├─ podRequestHandleMap.set("req-9f2", {
  │     status: 'pending',
  │     onComplete: (result, error) => {
  │        socket.join(...), ack(...), Viewer.create(...)
  │     }
  │  })
  │        ▲ stored LOCALLY on Pod B — never sent anywhere
  │
  ├─ publishCommand(payload, "A")
  │     spublish("pod:A:cmd", { type:'joinRoom', requestId:'req-9f2',
  │                              args:{roomId, socketId}, replyTo:'pod:B:response' })
  │                    │
  │                    │  (travels over Redis)
  │                    ▼
  │                                                 podConnectionSubscriber
  │                                                 hears smessage on "pod:A:cmd"
  │                                                   │
  │                                                   ├─ handleIncomingRequest(payload)
  │                                                   │   case 'joinRoom':
  │                                                   │     getRoom(roomId)      ← real local data, Pod A owns this
  │                                                   │     getRouter(routerId)
  |                                                   |     await joinAsViewer(roomId, socketId) //Add viewer in memory map POD owning the room. 
  │                                                   │     result = { rtpCapabilities, broadcasters }
  │                                                   │
  │                                                   └─ publishResponse(
  │                                                        { requestId:'req-9f2', result },
  │                                                        replyTo = "pod:B:response"
  │                                                      )
  │                    ┌──────────────────────────────────┘
  │                    │  (travels back over Redis)
  │                    ▼
podConnectionSubscriber
hears smessage on "pod:B:response"
  │
  ├─ handleIncomingResponse(payload)
  │     entry = podRequestHandleMap.get("req-9f2")   ← finds the SAME entry from step above
  │     entry.onComplete(result, error)              ← runs the stored function
  │        │
  │        ├─ socket.join(`room:${roomId}`)   ← real socket, lives on Pod B, works fine
  │        ├─ socket.data.roomId = roomId
  │        └─ ack({ success: true, data: result })   ← viewer FINALLY gets their answer
  │
  └─ podRequestHandleMap.delete("req-9f2")
```
