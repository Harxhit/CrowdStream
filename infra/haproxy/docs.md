## HAProxy Configuration

The repository ships with `haproxy.template.cfg` instead of a tracked
`haproxy.cfg` because it includes secerets.

Before starting HAProxy, create a local configuration:

```bash
cp infra/haproxy/haproxy.template.cfg infra/haproxy/haproxy.cfg
```

Then start HAProxy:

```bash
make haproxy-start
```

`haproxy.cfg` is intentionally ignored by Git to allow local customization and secret leaks without creating repository noise.