.PHONY: envoy-start envoy-logs envoy-stop

envoy-start:
	docker run -d \
		--name crowdstream-envoy \
		--network host \
		-v "$(CURDIR)/envoy.yaml:/etc/envoy/envoy.yaml:ro" \
		envoyproxy/envoy:v1.38.3\
		-c /etc/envoy/envoy.yaml

envoy-logs:
	docker logs -f crowdstream-envoy

envoy-stop:
	docker stop crowdstream-envoy
	docker rm crowdstream-envoy
