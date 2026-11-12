# Connectivity testing

How CrowdStream media reaches viewers on other networks, and how each path was tested. Last updated 12 Nov 2026.

## The problem

The broadcaster and server run on a laptop, and viewers join from other networks. Viewers' connections stayed in "connecting" because mediasoup announced the laptop's LAN address (`10.x.x.x`) in its ICE candidates, and the TURN URLs handed to the frontend pointed at the same private address. Neither is reachable from outside. On EC2 this never showed up because the Elastic IP is a public address.

## What changed

**mediasoup listens on a reachable address.** `createWebRtcTransport` uses `listenInfos` with the public IPv6 and the LAN IPv4, both from env (`PUBLIC_IPV6`, `LAN_IPV4`):

```ts
listenInfos: [
  { protocol: 'udp', ip: config.publicIpV6, portRange: { min: 40000, max: 40100 } },
  { protocol: 'tcp', ip: config.publicIpV6, portRange: { min: 40000, max: 40100 } },
  { protocol: 'udp', ip: config.annoucedIp, portRange: { min: 40000, max: 40100 } },
  { protocol: 'tcp', ip: config.annoucedIp, portRange: { min: 40000, max: 40100 } },
],
```

The IPv4 pair exists because a TURN relay candidate is IPv4, and a relay can only forward to a peer address of the same family.

**TURN credentials and URLs come from the backend.** `GET /turn/credentials` returns `username` (`<expiry>:<userId>`), `credential` (base64 HMAC-SHA1 of the username with `TURN_SECRET`), `ttl`, and `urls` built from `PUBLIC_IPV6`. The frontend's `getIceServers()` uses those and no longer reads `VITE_TURN_*` values.

**Coturn sits behind the load balancers.** Browsers reach Envoy (UDP 3480) and HAProxy (TCP 3479). Both forward over loopback: Envoy to Coturn 3478, HAProxy to Coturn 3481 with PROXY protocol v2. Coturn listens on `127.0.0.1` (plus the LAN and public addresses for direct testing) and has one `relay-ip` per address family.

**Config is generated from templates.** `turnserver.template.conf` and the HAProxy template are filled in with `envsubst`. The generated files, TLS keys and `.env` files are in `.gitignore`.

## Results

| Path | How it was tested | Result |
| --- | --- | --- |
| Direct, IPv6 | Phone on mobile data, `iceTransportPolicy: 'all'` | Works |
| Direct, IPv4 | Viewer on the same IPv4 network, `iceTransportPolicy: 'all'` | Works |
| Relay over UDP | `iceTransportPolicy: 'relay'` on viewer and broadcaster | Works. Selected pair: local `relay` (`relayProtocol: udp`), remote mediasoup IPv4 host candidate |
| Relay over TCP | Relay candidate gathered | Not yet tested on its own |
| Relay over TLS | Planned | Not started |

## Reproducing the tests

Get the addresses (fish). The IPv6 prefix changes whenever the hotspot reconnects, so do this on every start:

```fish
set -x PUBLIC_IPV6 (ip -6 route get 2001:4860:4860::8888 | grep -oP 'src \K\S+')
set -x LAN_IPV4 (ip -4 route get 1.1.1.1 | grep -oP 'src \K\S+')
```

1. Check inbound IPv6 works on the current network: serve a page with `python3 -m http.server 8000 --bind ::`, then open `http://[PUBLIC_IPV6]:8000` from a device on another network.
2. Check TURN on its own with the Trickle ICE sample page. Use `turn:[PUBLIC_IPV6]:3480?transport=udp` and credentials from `/turn/credentials`. A `relay` row means Envoy and Coturn work.
3. Start the backend with both variables set, connect a viewer from another network, and open `chrome://webrtc-internals`. Look at the selected candidate pair. To force relay, set `iceTransportPolicy: 'relay'` in the `RTCPeerConnection` config.

## Troubleshooting

- **ICE stays in `new` with relay-only policy.** No relay candidate was gathered, so ICE never starts. Check the Coturn log for an `ALLOCATE` request from the viewer's username.
- **"Authentication failed" in Trickle ICE.** The HMAC secret does not match `static-auth-secret`, or the frontend is sending fixed credentials instead of the ones from `/turn/credentials`.
- **Relay connects but no media.** The relay is IPv4 and mediasoup only announces IPv6. Keep the IPv4 `listenInfos`. If Coturn answers `CreatePermission` with 403, add `allowed-peer-ip` for the mediasoup address.
- **Lines with `:3481` and an empty username in the Coturn log.** That is HAProxy's health check connecting and closing. It is harmless.

