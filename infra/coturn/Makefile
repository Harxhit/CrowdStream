.PHONY: coturn-log
.PHONY: coturn-kill
.PHONY: coturn-start


coturn-log: 
	@echo "=== COTURN Log ==="
	turnserver -c infra/coturn/turnserver.conf

coturn-kill: 
	@echo "=== Killing COTURN ==="
	pkill turnserver
	@echo "=== Verifying ==="
	pgrep -a turnserver

coturn-start: 
	@echo "===Starting TURN ==="
	turnserver -c turnserver.conf
	@echo "=== Verifying ==="
	ss -ltnp | grep 3479