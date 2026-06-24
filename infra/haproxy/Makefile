.PHONY: check-haproxy-cpu
.PHONY: haproxy-cpu-affinity 
.PHONY: haproxy-worker-thread-count 
.PHONY: haproxy-kill
.PHONY: haproxy-start


check-haproxy-cpu:
	@echo "=== Checking HAProxy Thread Build Capabilities ==="
	haproxy -vv | grep -i thread

haproxy-cpu-affinity: 
	@echo "=== Checking HAProxy CPU affinity ==="
	ps -T -p $(pidof haproxy) -o pid,tid,psr,comm

haproxy-worker-thread-count: 
	@echo "=== Checking How Many Worker Thread are Running ==="
	taskset -pc ${pidof haproxy}

haproxy-kill: 
	@echo "=== Killing HAProxy ==="
	pkill haproxy
	@echo "=== Verifying ==="
	pgrep -a haproxy

haproxy-start: 
	@echo "=== Starting HAProxy ==="
	haproxy -W -db -f haproxy.cfg
	@echo "=== Verifying ==="
	ss -ltnp | grep 3478
	