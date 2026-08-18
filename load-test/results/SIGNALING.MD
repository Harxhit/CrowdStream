# Signaling Load Testing

## What I load tested

The load tester simulates concurrent viewers going through the CrowdStream signaling flow:

```
Socket.IO connection
        ↓
joinRoom
        ↓
createViewerTransport
        ↓
connectConsumerTransport
        ↓
consume
        ↓
resumeConsumer
```

For load testing, the joinRoom rate limiter is temporarily commented out.

This tests the signaling/control path and mediasoup viewer setup. It does not test packet loss or actual media delivery.

#### Results

| Viewers | Ramp | Success | Errors | Total Avg | Total P99 |
|---:|---:|---:|---:|---:|---:|
| 100 | 10s | 100/100 | 0 | 21.6 ms | 52.8 ms |
| 250 | 10s | 250/250 | 0 | 16.0 ms | 81.0 ms |
| 500 | 15s | 500/500 | 0 | 16.4 ms | 72.9 ms |
| 1,000 | 20s | 1,000/1,000 | 0 | 16.8 ms | 179.2 ms |
| 1,500 | 30s | 1,500/1,500 | 0 | 11.9 ms | 67.8 ms |
| 2,000 | 30s | 2,000/2,000 | 0 | 23.5 ms | 218.5 ms |
| 3,000 | 100s | **3,000/3,000** | **0** | **11.2 ms** | **36.0 ms** |

### At 3,000 simulated viewers:
```
Viewers:                    3,000
Successful:                 3,000
Errors:                         0

Socket connections:         3,000
Viewer transports:          3,000
Consume operations:         3,000
Consumer resumes:           6,000

Total signaling:
  Average:                  11.2 ms
  P50:                       9.4 ms
  P95:                      18.0 ms
  P99:                      36.0 ms
  Max:                     178.2 ms
```
### Spike test

A separate 10,000-viewer / 2-second burst was also tested:

```
Attempted:                 10,000
Successful:                 1,861
Failed:                     8,139
```

The failures were primarily: **connection timeout**

