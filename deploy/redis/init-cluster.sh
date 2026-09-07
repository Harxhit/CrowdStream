#!/bin/sh
# Initialize the 6-node Redis cluster used by the backend for sharded pub/sub.
#
# Runs as a one-shot, host-networked init container (see the compose files), so
# the nodes are reachable on 127.0.0.1. Idempotent: exits early if the cluster
# is already formed, otherwise creates it (3 masters + 3 replicas).
set -e

HOST="127.0.0.1"
PORTS="6379 6380 6381 6382 6383 6384"

echo "Waiting for Redis nodes..."
for PORT in $PORTS; do
    echo "  waiting for $HOST:$PORT ..."
    until redis-cli -h "$HOST" -p "$PORT" ping >/dev/null 2>&1; do
        sleep 1
    done
    echo "  $HOST:$PORT is up."
done

if redis-cli -h "$HOST" -p 6379 cluster info 2>/dev/null | grep -q "cluster_state:ok"; then
    echo "Redis cluster already initialized."
    exit 0
fi

echo "Creating Redis cluster (3 masters + 3 replicas)..."
redis-cli --cluster create \
    "$HOST:6379" "$HOST:6380" "$HOST:6381" \
    "$HOST:6382" "$HOST:6383" "$HOST:6384" \
    --cluster-replicas 1 \
    --cluster-yes

echo "Redis cluster created successfully."
