#!/bin/sh

set -e

ENV_PATH="../../backend/.env"

if [ -f "$ENV_PATH" ]; then
    set -a
    . "$ENV_PATH"
    set +a
    echo "Environment loaded successfully from $ENV_PATH"
else
    echo "Error: Environment file not found: $ENV_PATH"
    exit 1
fi

HOST="$REDIS_HOST"
PORTS="$REDIS_PORT1 $REDIS_PORT2 $REDIS_PORT3 $REDIS_PORT4 $REDIS_PORT5 $REDIS_PORT6"

echo "Waiting for Redis nodes..."

for PORT in $PORTS
do
    echo "Waiting for Redis on $HOST:$PORT..."

    while ! docker exec redis-1 redis-cli -h "$HOST" -p "$PORT" ping >/dev/null 2>&1
    do
        sleep 1
    done

    echo "Redis on $HOST:$PORT is ready."
done

echo "Checking Redis Cluster..."

if docker exec redis-1 redis-cli -h "$HOST" -p "$REDIS_PORT1" cluster info | grep -q "cluster_state:ok"
then
    echo "Redis Cluster already initialized."
    exit 0
fi

echo "Creating Redis Cluster..."

docker exec redis-1 redis-cli --cluster create \
"$HOST:$REDIS_PORT1" \
"$HOST:$REDIS_PORT2" \
"$HOST:$REDIS_PORT3" \
"$HOST:$REDIS_PORT4" \
"$HOST:$REDIS_PORT5" \
"$HOST:$REDIS_PORT6" \
--cluster-replicas 1 \
--cluster-yes

echo "Redis Cluster created successfully."