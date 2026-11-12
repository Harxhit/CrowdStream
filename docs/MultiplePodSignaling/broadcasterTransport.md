```txt
# Cross-Pod Co-Broadcaster: Create Broadcaster Transport

> IMPORTANT:
>
> This flow is specifically for a **co-broadcaster whose Socket.IO
> connection lands on a different pod from the pod that owns the room
> and Mediasoup router**.
>
> The original room creator/broadcaster normally already lives on the
> room-owning pod and does not need this cross-pod forwarding path.
>
> This cross-pod flow exists for:
>
>   Co-Broadcaster Socket → POD B
>   Room + Router Owner    → POD A
>
> POD A must create and own the actual Mediasoup producer transport.

---

POD B (Co-Broadcaster socket lives here)          POD A (owns Room + Router)
─────────────────────────────────────────        ──────────────────────────────

socket.on("createBroadcasterTransport")
  │
  ├─ roomId received from client
  ├─ socketId = socket.id
  ├─ hostUserId = socket.data.user?.id
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │
  │    → nodeId = "A"
  │    → config.instanceId = "B"
  │
  ├─ nodeId !== instanceId
  │
  ▼
CROSS-POD PATH
  │
  ├─ requestId = crypto.randomUUID()
  │
  ├─ Create payload:
  │
  │    {
  │      type: "createBroadcasterTransport",
  │      requestId,
  │      args: {
  │        roomId,
  │        socketId
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set(requestId, {
  │
  │     status: "pending",
  │     requestType: "createBroadcasterTransport",
  │
  │     onComplete: (result, error) => {
  │
  │        clearTimeout(timeoutHandle)
  │
  │        if (error) {
  │
  │           ack({
  │             success: false,
  │             code: "TRANSPORT_CREATION_FAILED"
  │           })
  │
  │           return
  │        }
  │
  │        ack({
  │          success: true,
  │          data: result
  │        })
  │
  │        Broadcaster.findOneAndUpdate(...)
  │
  │        → store result.id in transportIds
  │     }
  │  })
  │
  │        ▲
  │        │
  │        │ Stored LOCALLY on POD B
  │        │ This entry waits for POD A's response
  │        │
  ├─ publishCommand(payload, "A")
  │
  │       spublish("pod:A:cmd", {
  │
  │         type: "createBroadcasterTransport",
  │         requestId,
  │
  │         args: {
  │           roomId,
  │           socketId
  │         },
  │
  │         replyTo: "pod:B:response"
  │       })
  │
  │
  │                        │
  │                        │ Redis
  │                        ▼
  │
  │                                      POD A
  │                                      │
  │                                      │ podConnectionSubscriber
  │                                      │ receives "pod:A:cmd"
  │                                      ▼
  │
  │                              handleIncomingRequest(payload)
  │                                      │
  │                                      ├─ type ===
  │                                      │  "createBroadcasterTransport"
  │                                      │
  │                                      ▼
  │
  │                              roomToRouter.get(roomId)
  │                                      │
  │                                      ▼
  │
  │                              Get routerId
  │                                      │
  │                                      ▼
  │
  │                              getRouter(routerId)
  │                                      │
  │                                      ▼
  │
  │                         createWebRtcTransport(
  │                           router,
  │                           roomId,
  │                           socketId,
  │                           "producer"
  │                         )
  │                                      │
  │                                      ▼
  │
  │                          Mediasoup creates the
  │                          PRODUCER TRANSPORT
  │                          on POD A
  │                                      │
  │                                      ▼
  │
  │                              result = {
  │                                id,
  │                                iceParameters,
  │                                iceCandidates,
  │                                dtlsParameters
  │                              }
  │                                      │
  │                                      ▼
  │
  │                              addBroadcaster(
  │                                roomId,
  │                                socketId
  │                              )
  │                                      │
  │                                      ▼
  │
  │                         saveBroadcasterTransport(
  │                           roomId,
  │                           socketId,
  │                           broadcasterTransport
  │                         )
  │
  │                                      │
  │                                      ▼
  │
  │                              Room state on POD A:
  │
  │                              room.broadcasters
  │                                └── socketId
  │                                     └── producer transport
  │
  │                                      │
  │                                      ▼
  │
  │                              publishResponse(
  │                                {
  │                                  requestId,
  │                                  result
  │                                },
  │                                "pod:B:response"
  │                              )
  │
  │                    ▲
  │                    │
  │                    │ Redis
  │                    │
  └────────────────────┘
                       │
                       ▼

POD B
  │
  ├─ podConnectionSubscriber
  │
  ├─ receives:
  │
  │    "pod:B:response"
  │
  ▼
handleIncomingResponse(payload)
  │
  ├─ podRequestHandleMap.get(requestId)
  │
  ├─ Finds the SAME pending request
  │
  ├─ Calls:
  │
  │    entry.onComplete(
  │      payload.result,
  │      payload.error
  │    )
  │
  ▼
onComplete(result, error)
  │
  ├─ clearTimeout(timeoutHandle)
  │
  ├─ If error:
  │
  │    ack({
  │      success: false,
  │      code: "TRANSPORT_CREATION_FAILED"
  │    })
  │
  └─ If success:
       │
       ├─ ack({
       │    success: true,
       │    data: {
       │      id,
       │      iceParameters,
       │      iceCandidates,
       │      dtlsParameters
       │    }
       │  })
       │
       ▼
       
       Broadcaster.findOneAndUpdate(...)
       
       $push:
         transportIds: result.id
       
       ▼
       
       Co-broadcaster database record
       now contains the transport ID
       
       ▼
       
       podRequestHandleMap.delete(requestId)
```