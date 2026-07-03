.PHONY: start
.PHONY: start-infra
.PHONY: start-networking

start:
	@echo "=== Starting CrowdStream ==="
	@(cd backend && npm run dev) &
	@(cd frontend && npm run dev) &
	@wait


start-infra: 
	@echo "=== Starting CrowdStream Infra ==="
	@(cd infra/coturn && make coturn-start) &
	@(cd infra/envoy && docker compose up) &
	@(cd infra/ngrok && docker compose up) &
	@(cd infra/nginx && docker compose up) &
	@(cd infra/haproxy && make haproxy-start) &
	@wait

start-networking:
		@echo "=== Starting CrowdStream Infra ==="
	@(cd infra/ngrok && docker compose up) &
	@(cd infra/nginx && docker compose up) &
	@wait
