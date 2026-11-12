.PHONY: coturn-log
.PHONY: coturn-kill
.PHONY: coturn-start

coturn-log: 
	@echo "=== COTURN Log ==="
	tail -f /var/tmp/turn.log

coturn-kill: 
	@echo "=== Killing COTURN ==="
	pkill turnserver
	@echo "=== Verifying ==="
	-pgrep -a turnserver

coturn-start: 
	@echo "===Starting TURN ==="
	turnserver -c turnserver.conf
	@echo "=== Verifying ==="
	ss -ltnp | grep 3478
