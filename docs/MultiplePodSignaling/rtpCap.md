```txt
```text
POD B (viewer socket lives here)                    POD A (owns the room/router)
────────────────────────────────────              ─────────────────────────────

socket.on("getRouterRtpCapabilities")
  │
  ├─ roomId received from client
  ├─ socketId = socket.id
  │
  ├─ Validate roomId
  │
  ├─ getRedisRoom(`room:${roomId}`)
  │
  │    → Redis lookup fails?
  │         │
  │         ├─ ack({
  │         │    success: false,
  │         │    code: "RTP_CAPABILITES_ERROR"
  │         │  })
  │         │
  │         └─ return
  │
  │    → nodeId = "A" ≠ config.instanceId ("B")
  │
  ├─ requestId = "req-rtp-42"
  │
  ├─ Create payload:
  │
  │    {
  │      type: "getRtpCapabilites",
  │      requestId: "req-rtp-42",
  │      args: {
  │        roomId,
  │        socketId
  │      },
  │      replyTo: "pod:B:response"
  │    }
  │
  ├─ Start timeout (5000ms)
  │
  ├─ podRequestHandleMap.set("req-rtp-42", {
  │     status: "pending",
  │     requestType: "getRtpCapabilites",
  │
  │     onComplete: (result, error) => {
  │
  │        clearTimeout(timeoutHandle)
  │
  │        if (error) {
  │           ack({
  │             success: false,
  │             code: "RTP_CAPABILITES_ERROR"
  │           })
  │           return
  │        }
  │
  │        ack({
  │          success: true,
  │          data: result
  │        })
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
  │        type: "getRtpCapabilites",
  │        requestId: "req-rtp-42",
  │        args: {
  │          roomId,
  │          socketId
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
  │                                                │  "getRtpCapabilites"
  │                                                │
  │                                                ├─ extract:
  │                                                │
  │                                                │  roomId
  │                                                │  socketId
  │                                                │
  │                                                ▼
  │                                      roomToRouter.get(roomId)
  │                                                │
  │                                                ▼
  │                                      routerId found
  │                                      on Pod A
  │                                                │
  │                                                ▼
  │                                      getRouter(routerId)
  │                                                │
  │                                                ▼
  │                                      Get local Mediasoup router
  │                                                │
  │                                                ▼
  │                                      router.rtpCapabilities
  │                                                │
  │                                                ▼
  │                                      result = {
  │                                        rtpCapabilities
  │                                      }
  │
  │                                      OR depending on
  │                                      response implementation:
  │
  │                                      result = rtpCapabilities
  │                                                │
  │                                                ▼
  │                                      publishResponse(
  │                                         {
  │                                           requestId:
  │                                             "req-rtp-42",
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
  │    podRequestHandleMap.get("req-rtp-42")
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
  │    │          code: "RTP_CAPABILITES_ERROR"
  │    │        })
  │    │
  │    └─ if successful
  │          │
  │          └─ ack({
  │               success: true,
  │               data: rtpCapabilities
  │             })
  │
  └─ podRequestHandleMap.delete("req-rtp-42")
```

```