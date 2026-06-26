.PHONY: start

start:
	@echo "=== Starting CrowdStream ==="
	@(cd backend && npm run dev) &
	@(cd frontend && npm run dev) &
	@wait