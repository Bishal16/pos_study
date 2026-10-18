#!/usr/bin/env bash
# READ-ONLY: locates the source code / infra folders that ODCL will need, so the
# right repos can be requested by name. Copies nothing, prints no file contents,
# strips credentials from git remote URLs.
# Usage on the server:  bash server-locate-sources.sh > locate-$(hostname)-$(date +%F).txt 2>&1

W=/mnt/workspace
sec() { echo; echo "=================== $* ==================="; }
clean_url() { sed -E 's#(://)[^/@]+@#\1#'; }   # drop user:token@ from URLs

describe() {
  d="$1"
  [ -d "$d" ] || { echo "(missing) $d"; return; }
  echo "--- $d"
  echo "owner/perm: $(stat -c '%U %A' "$d")   size: $(du -sh "$d" 2>/dev/null | cut -f1)"
  if git -C "$d" rev-parse --git-dir >/dev/null 2>&1; then
    echo "git: yes   branch: $(git -C "$d" branch --show-current 2>/dev/null)"
    git -C "$d" remote -v 2>/dev/null | awk '{print "remote: "$1" "$2}' | sort -u | clean_url
    echo "last commit: $(git -C "$d" log -1 --format='%ci %an | %s' 2>/dev/null)"
    echo "uncommitted changes: $(git -C "$d" status --porcelain 2>/dev/null | wc -l) files"
  else
    echo "git: no (not a repository — likely a copied folder)"
  fi
  echo "files by type:"
  find "$d" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null \
    | sed -E 's#.*/##; s#^[^.]*$#(no-ext)#; s#.*\.##' | sort | uniq -c | sort -rn | head -12 | sed 's/^/   /'
  echo "key markers:"
  for m in package.json tsconfig.json Dockerfile docker-compose.yml main.tf variables.tf pom.xml kong.yml kong.yaml .gitlab-ci.yml; do
    n=$(find "$d" -name "$m" -not -path '*/node_modules/*' 2>/dev/null | wc -l)
    [ "$n" -gt 0 ] && echo "   $m x$n"
  done
  [ -d "$d/app/src" ] && echo "   app/src present: $(find "$d/app/src" -type f | wc -l) source files"
}

sec "ALL TOP-LEVEL FOLDERS IN $W (name, git?, remote)"
for d in "$W"/*/; do
  d=${d%/}
  r=$(git -C "$d" remote get-url origin 2>/dev/null | clean_url)
  printf '%-40s %s\n' "$(basename "$d")" "${r:-(no git remote)}"
done

sec "GATEWAY / KONG"
describe "$W/apollo-server"
describe "$W/api-gateway"

sec "INFRA (Terraform / compose)"
for f in message-broker object-storage service-registry docker-network pulsehub caching-service; do describe "$W/$f"; done

sec "ORDER SERVICE (source or only a .war?)"
for d in "$W"/order* "$W"/orders*; do [ -d "$d" ] && describe "$d"; done
find "$W" -maxdepth 3 -iname '*order*.war' -not -path "$W/docker/*" 2>/dev/null | sed 's/^/war: /'
docker inspect order-service orders-service --format '{{.Name}} image={{.Config.Image}} mounts:{{range .Mounts}} {{.Source}}{{end}}' 2>/dev/null

sec "KONG CONFIG (exists in DB — just report what's there, names only)"
curl -s --max-time 3 http://localhost:8001/services 2>/dev/null | grep -oE '"name":"[^"]+"' | sort -u
curl -s --max-time 3 http://localhost:8001/routes   2>/dev/null | grep -oE '"name":"[^"]+"' | sort -u
curl -s --max-time 3 http://localhost:8001/plugins  2>/dev/null | grep -oE '"name":"[^"]+"' | sort -u | sed 's/^/plugin /'

echo; echo "DONE"
