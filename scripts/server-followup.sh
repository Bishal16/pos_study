#!/usr/bin/env bash
# UniPOS server follow-up: READ-ONLY. Fills the gaps from server-inventory.sh on the dev server.
# Run:  bash server-followup.sh > followup-$(hostname)-$(date +%F).txt 2>&1
# (works without sudo if your user is in the docker group; nothing is started/stopped/changed)

MASK='s/(([A-Za-z0-9_.-]*(PASS|SECRET|KEY|TOKEN|CREDENTIAL|PWD)[A-Za-z0-9_.-]*)\s*[=:]\s*).*/\1***MASKED***/I'
sec() { echo; echo "=================== $* ==================="; }
show() { [ -f "$1" ] && { echo "########## $1"; sed -E "$MASK" "$1" | head -${2:-300}; }; }

W=/mnt/workspace

sec "1. /mnt/workspace infra folders (tree, 2 levels)"
for d in pulsehub message-broker object-storage docker-network service-registry apollo-server api-gateway caching-service compliance-service notification-service order-service test; do
  echo "--- $W/$d"; find "$W/$d" -maxdepth 2 -not -name '*.war' -not -path '*/node_modules*' -not -path '*/.terraform*' 2>/dev/null | head -40
done

sec "2. Compose / config files under /mnt/workspace (masked)"
find "$W" -maxdepth 3 \( -path "$W/docker" -o -path '*/node_modules' \) -prune -o \
  \( -name 'docker-compose*.y*ml' -o -name 'compose*.y*ml' -o -name '*.hcl' -o -name 'config.yaml' \
     -o -name 'prometheus.yml' -o -name 'sampling_strategies.json' -o -name '*.env' -o -name 'Dockerfile' -o -name 'main.tf' \) \
  -print 2>/dev/null | grep -vE '/(accounts|approval|authentication|authorization|configuration|customer|inventory|payment|policy|product|promotion|purchase|report|sales|vat)-service/' \
  | while read -r f; do show "$f" 200; done

sec "3. Apollo gateway (container apollo-server): package.json + how it finds subgraphs"
docker exec apollo-server sh -c 'cat /app/package.json; echo; ls -R /app/dist | head -60' 2>/dev/null
docker exec apollo-server sh -c 'grep -rhoE "(serviceList|IntrospectAndCompose|supergraphSdl|consul[A-Za-z.]*|subgraphs?[A-Za-z]*|jwt[A-Za-z.]*|verify\([^)]*\))" /app/dist 2>/dev/null | sort | uniq -c | head -40'
echo "--- recent apollo log lines (subgraph composition)"
docker logs --tail 60 apollo-server 2>&1 | sed -E "$MASK"

sec "4. Kong: plugins (auth? rate limit? cors?) and consumers count"
curl -s --max-time 3 http://localhost:8001/plugins | sed -E 's/"(secret|key|password|credentials?)":"[^"]*"/"\1":"***"/Ig' | head -c 6000; echo
curl -s --max-time 3 http://localhost:8001/consumers | grep -o '"username":"[^"]*"' | head -20

sec "5. Kafka topics & consumer groups (container: kafka)"
docker exec kafka kafka-topics --bootstrap-server localhost:29092 --list 2>/dev/null
echo "--- consumer groups"
docker exec kafka kafka-consumer-groups --bootstrap-server localhost:29092 --list 2>/dev/null
echo "--- lag per group"
for g in $(docker exec kafka kafka-consumer-groups --bootstrap-server localhost:29092 --list 2>/dev/null); do
  docker exec kafka kafka-consumer-groups --bootstrap-server localhost:29092 --describe --group "$g" 2>/dev/null | awk 'NR==1||$6>0' | head -15
done

sec "6. Why are services 'unhealthy'? (last healthcheck result + curl present?)"
for c in sales-service accounts-service product-service configuration-service authentication-service; do
  echo "--- $c"
  docker inspect "$c" --format '{{json .State.Health.Log}}' 2>/dev/null | tr '}' '\n' | tail -2
  docker exec "$c" sh -c 'command -v curl || echo "curl NOT installed"' 2>/dev/null
done

sec "7. Extra services not in the local repos: what are they?"
for c in compliance-service notification-service order-service; do
  echo "--- $c"; docker logs --tail 15 "$c" 2>&1 | grep -iE "Started|profile|port|ERROR" | head -8
done

sec "8. Log sizes (docker json-file, no rotation configured)"
cat /etc/docker/daemon.json 2>/dev/null | sed -E "$MASK"
du -sh "$W"/docker/containers/*/*-json.log 2>/dev/null | sort -h | tail -10

sec "9. Postgres on this host (127.0.0.1:5432) — which databases? (names only)"
psql -w -h 127.0.0.1 -U postgres -lqt 2>/dev/null | cut -d'|' -f1 | sed '/^\s*$/d' || echo "(no access without password — skip)"

sec "10. Where does the frontend run?"
docker ps --format '{{.Names}} {{.Ports}}' | grep -iE 'web|front|next|3000' ; ps -eo user,cmd | grep -iE 'next|pm2' | grep -v grep | head

echo; echo DONE
