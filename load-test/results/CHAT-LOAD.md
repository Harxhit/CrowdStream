## Results

### Run 1 — 200 receivers / 20 senders

| Metric                |                         Result |
| --------------------- | -----------------------------: |
| Pods                  |                          **1** |
| Receivers             |                        **200** |
| Senders               |                         **20** |
| Messages/sender       |                         **10** |
| Messages sent         |                        **200** |
| Messages broadcast    |                         **25** |
| Fan-out p50           |                      **61 ms** |
| Fan-out p99           |                      **81 ms** |
| Deliveries received   |              **5,000 / 5,000** |
| Fully fanned-out      |                    **25 / 25** |
| Delivery completeness | **100% of broadcast messages** |
| Rate-limited          |                        **175** |
| Moderated             |                          **0** |
| Connect errors        |                          **0** |
| Join errors           |                          **0** |

**Result: PASS.** All 25 messages accepted by the server were delivered to all 200 receivers. The remaining 175 messages were blocked by the configured rate limiter.

### Run 2 — 500 receivers / 50 senders

| Metric                |                         Result |
| --------------------- | -----------------------------: |
| Pods                  |                          **1** |
| Receivers             |                        **500** |
| Senders               |                         **50** |
| Messages/sender       |                         **10** |
| Messages sent         |                        **500** |
| Messages broadcast    |                         **25** |
| Fan-out p50           |                      **94 ms** |
| Fan-out p99           |                     **141 ms** |
| Deliveries received   |            **12,500 / 12,500** |
| Fully fanned-out      |                    **25 / 25** |
| Delivery completeness | **100% of broadcast messages** |
| Rate-limited          |                        **475** |
| Moderated             |                          **0** |
| Connect errors        |                          **0** |
| Join errors           |                          **0** |

**Result: PASS.** All 25 messages accepted by the server were delivered to all 500 receivers. The remaining 475 messages were blocked by the configured rate limiter.

### Scaling comparison

| Pods | Receivers | Senders | Msgs/sender | Fan-out p50 | Fan-out p99 | Delivery completeness | Rate-limited |
| ---: | --------: | ------: | ----------: | ----------: | ----------: | --------------------: | -----------: |
|    1 |       200 |      20 |          10 |   **61 ms** |   **81 ms** |              **100%** |          175 |
|    1 |       500 |      50 |          10 |   **94 ms** |  **141 ms** |              **100%** |          475 |

Moving from 200 to 500 receivers increased fan-out p99 latency from **81 ms to 141 ms**, while all server-accepted broadcasts continued to reach every receiver.

The tests therefore demonstrate successful single-pod fan-out at **500 concurrent receivers**, with no connection or join failures and no delivery loss for messages that passed the server's rate-limit gate.

### Overall status

* **200 receivers:** PASS
* **500 receivers:** PASS
* **Accepted-message delivery completeness:** 100%
* **Connection errors:** 0
* **Join errors:** 0
* **Moderation failures:** 0
* **Cross-pod fan-out:** Not tested yet
* **Distinct-user rate-limit behavior:** Not tested yet

### Conclusion

The single-pod chat fan-out tests successfully handled **200 and 500 concurrent receivers**.

For messages accepted by the server:

* **200 receivers:** 5,000/5,000 deliveries
* **500 receivers:** 12,500/12,500 deliveries

Fan-out p99 increased from **81 ms** at 200 receivers to **141 ms** at 500 receivers, while delivery completeness remained **100%**.

The configured rate limiter blocked 175/200 messages in the 200-receiver test and 475/500 messages in the 500-receiver test. These messages were intentionally prevented from entering the broadcast path and are therefore excluded from the accepted-message delivery-completeness calculation.

The current results validate the **single-pod fan-out path**. The original Week 5 roadmap item also requires testing **fan-out across ≥2 signaling pods using Redis**, which remains to be validated separately.
