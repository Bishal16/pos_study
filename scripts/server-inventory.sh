#!/usr/bin/env bash
# UniPOS server inventory: READ-ONLY. Nothing here starts, stops, or changes anything.
# Usage on the server:   sudo bash server-inventory.sh > inventory-$(hostname)-$(date +%F).txt 2>&1
# Secrets are masked: any env var / config line whose name contains PASS, SECRET, KEY, TOKEN, CREDENTIAL, PWD.

MASK='s/(([A-Za-z0-9_.-]*(PASS|SECRET|KEY|TOKEN|CREDENTIAL|PWD)[A-Za-z0-9_.-]*)\s*[=:]\s*).*/\1***MASKED***/I'
sec() { echo; echo "=================== $* ==================="; }
have() { command -v "$1" >/dev/null 2>&1; }

sec "HOST"
hostname; uname -r; cat /etc/os-release 2>/dev/null | head -2
uptime; nproc; free -h; df -h -x tmpfs -x overlay 2>/dev/null

sec "LISTENING PORTS"
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | sed -E 's/users:\(\(.*//'

sec "SYSTEMD SERVICES (running, non-system)"
systemctl list-units --type=service --state=running --no-pager 2>/dev/null \
  | grep -viE 'systemd|dbus|getty|cron|ssh|polkit|udisks|network|rsyslog|snap|user@|accounts-daemon|multipathd|unattended'

sec "DOCKER CONTAINERS"
if have docker; then
  docker version --format 'docker {{.Server.Version}}' 2>/dev/null
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

  sec "DOCKER NETWORKS"
  docker network ls
  for n in $(docker network ls --format '{{.Name}}' | grep -vE '^(bridge|host|none)$'); do
    echo "--- $n"
    docker network inspect "$n" --format '{{range .IPAM.Config}}subnet={{.Subnet}}{{end}}{{range .Containers}}
   {{.Name}} {{.IPv4Address}}{{end}}'
  done

  sec "DOCKER VOLUMES"
  docker volume ls

  sec "PER-CONTAINER DETAILS (image, compose project, labels, env names masked, mounts, cmd)"
  for c in $(docker ps -a --format '{{.Names}}'); do
    echo "--- $c"
    docker inspect "$c" --format 'image={{.Config.Image}}
created={{.Created}}
restart={{.HostConfig.RestartPolicy.Name}}
compose_project={{index .Config.Labels "com.docker.compose.project"}}
compose_dir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
compose_files={{index .Config.Labels "com.docker.compose.project.config_files"}}
cmd={{json .Config.Cmd}} entrypoint={{json .Config.Entrypoint}}
logdriver={{.HostConfig.LogConfig.Type}} {{json .HostConfig.LogConfig.Config}}
mounts:{{range .Mounts}} {{.Source}}->{{.Destination}}{{end}}' 2>/dev/null
    echo "env:"; docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -E "$MASK" | sed 's/^/   /'
  done
else
  echo "docker not installed"
fi

sec "COMPOSE / TERRAFORM / DEPLOY FILES ON DISK"
find / /mnt/workspace -xdev \( -path /proc -o -path /sys -o -path '*/node_modules' -o -path /var/lib/docker -o -path /mnt/workspace/docker \) -prune -o \
  \( -name 'docker-compose*.y*ml' -o -name 'compose*.y*ml' -o -name 'main.tf' -o -name 'ecosystem.config.*' \
     -o -name 'kong.y*ml' -o -name 'kong.conf' -o -name 'otel*config*.y*ml' -o -name 'prometheus.y*ml' \
     -o -name 'filebeat.y*ml' -o -name 'logstash*.conf' -o -name 'promtail*.y*ml' -o -name 'nginx.conf' \) \
  -print 2>/dev/null | head -100

sec "CONTENT OF COMPOSE / OBSERVABILITY CONFIG FILES (masked)"
for f in $(find / /mnt/workspace -xdev \( -path /proc -o -path /sys -o -path '*/node_modules' -o -path /var/lib/docker -o -path /mnt/workspace/docker \) -prune -o \
  \( -name 'docker-compose*.y*ml' -o -name 'compose*.y*ml' -o -name 'kong.y*ml' -o -name 'otel*config*.y*ml' \
     -o -name 'prometheus.y*ml' -o -name 'filebeat.y*ml' -o -name 'promtail*.y*ml' \) -print 2>/dev/null | head -30); do
  echo "########## $f"; sed -E "$MASK" "$f" | head -300
done

sec "APOLLO GATEWAY (serviceList)"
if have docker; then
  for c in $(docker ps --format '{{.Names}}' | grep -iE 'apollo|gateway'); do
    echo "--- $c"
    docker exec "$c" sh -c 'cat /app/index.js 2>/dev/null || cat /usr/src/app/index.js 2>/dev/null || ls -la /app /usr/src/app 2>/dev/null' | head -80
  done
fi

sec "CONSUL CATALOG"
for h in localhost:8500 consul:8500; do
  curl -s --max-time 3 "http://$h/v1/catalog/services" && { echo; echo "(from $h)"; break; }
done

sec "KAFKA TOPICS & CONSUMER GROUPS"
if have docker; then
  k=$(docker ps --format '{{.Names}}' | grep -iE 'kafka' | grep -viE 'ui|connect|zoo|rest' | head -1)
  if [ -n "$k" ]; then
    echo "broker container: $k"
    for bin in kafka-topics kafka-topics.sh /opt/kafka/bin/kafka-topics.sh /opt/bitnami/kafka/bin/kafka-topics.sh; do
      docker exec "$k" sh -c "command -v $bin >/dev/null 2>&1 || [ -x $bin ]" 2>/dev/null || continue
      docker exec "$k" $bin --bootstrap-server localhost:29092 --list 2>/dev/null
      cg=${bin/topics/consumer-groups}
      echo "--- consumer groups"; docker exec "$k" $cg --bootstrap-server localhost:29092 --list 2>/dev/null
      break
    done
  fi
fi

sec "KONG (if present)"
curl -s --max-time 3 http://localhost:8001/services 2>/dev/null | head -c 4000; echo
curl -s --max-time 3 http://localhost:8001/routes 2>/dev/null | head -c 4000; echo

sec "PM2 (frontend)"
have pm2 && pm2 list 2>/dev/null
ps -eo user,cmd | grep -iE 'pm2|next-server|node .*next' | grep -v grep | head

sec "NGINX / REVERSE PROXY SITES"
ls /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do [ -f "$f" ] && { echo "### $f"; sed -E "$MASK" "$f"; }; done 2>/dev/null

sec "/mnt/workspace layout"
ls -la /mnt/workspace 2>/dev/null

echo; echo "DONE"
