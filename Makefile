.PHONY: start

start:
	@echo "=== Starting CrowdStream ==="
	@(cd backend && npm run dev) &
	@(cd frontend && npm run dev) &
	@(cd infra/haproxy && $(MAKE) haproxy-start) &
	@(cd infra/coturn && $(MAKE) coturn-start) &
	@wait