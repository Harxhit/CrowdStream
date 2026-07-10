.PHONY: redis-cluster-up

redis-cluster-up: 
	@echo "------Stating REDIS CLUSTER-------"
	docker compose up -d
	./init-cluster.sh
