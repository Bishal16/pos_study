#!/usr/bin/env bash
# Collects gateway / Kong / infra / order-service sources from the dev server into ONE tarball.
# Changes nothing on the server except creating the output folder in your home directory.
# Leaves out live secrets: .env*, Terraform state, private keys, credentials files, node_modules, build output.
# Usage on the server:  bash server-collect-sources.sh
# Then on your PC:      scp <user>@192.168.20.190:~/unipos-collect-*.tar.gz ~/Downloads/projects/

set -u
W=/mnt/workspace
STAMP=$(date +%F)
OUT="$HOME/unipos-collect-$STAMP"
mkdir -p "$OUT"/{folders,git-bundles,kong,order-service}

FOLDERS="apollo-server api-gateway message-broker object-storage service-registry docker-network pulsehub caching-service"

EXCLUDES=(
  --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='target' --exclude='build'
  --exclude='.env' --exclude='.env.*' --exclude='*.env' --exclude='terraform.tfvars' --exclude='consul-data' --exclude='*.tfstate' --exclude='*.tfstate.*' --exclude='.terraform'
  --exclude='*.pem' --exclude='*.key' --exclude='*.p12' --exclude='*.jks' --exclude='id_rsa*'
  --exclude='*credential*' --exclude='*secret*' --exclude='*.war' --exclude='*.jar' --exclude='data' --exclude='logs'
)

echo "== 1. Folders (working copy, secrets excluded)"
for f in $FOLDERS; do
  if [ -d "$W/$f" ]; then
    tar -C "$W" "${EXCLUDES[@]}" -czf "$OUT/folders/$f.tar.gz" "$f" 2>/dev/null \
      && echo "   ok  $f ($(du -h "$OUT/folders/$f.tar.gz" | cut -f1))"
  else
    echo "   --  $f not found"
  fi
done

echo "== 2. Git history (bundle) where the folder is a git repo"
for f in $FOLDERS; do
  if git -C "$W/$f" rev-parse --git-dir >/dev/null 2>&1; then
    git -C "$W/$f" bundle create "$OUT/git-bundles/$f.bundle" --all >/dev/null 2>&1 \
      && echo "   ok  $f.bundle  (remote: $(git -C "$W/$f" remote get-url origin 2>/dev/null | sed -E 's#(://)[^/@]+@#\1#'))"
  fi
done

echo "== 3. order-service"
for d in "$W"/order* "$W"/orders*; do
  [ -d "$d" ] && tar -C "$W" "${EXCLUDES[@]}" -czf "$OUT/order-service/$(basename "$d").tar.gz" "$(basename "$d")" \
    && echo "   ok  folder $(basename "$d")"
done
# compiled war (only useful if no source exists; it is NOT source code)
find "$W" -maxdepth 3 -iname '*order*.war' -not -path "$W/docker/*" -exec cp {} "$OUT/order-service/" \; -exec echo "   war {}" \; 2>/dev/null

echo "== 4. Kong configuration (services, routes, plugins, upstreams — no consumers/credentials)"
for e in services routes plugins upstreams; do
  curl -s --max-time 5 "http://localhost:8001/$e?size=1000" -o "$OUT/kong/$e.json" && echo "   ok  $e.json"
done

echo "== 5. Manifest"
( cd "$OUT" && find . -type f | sort ) > "$OUT/MANIFEST.txt"
echo "   files: $(wc -l < "$OUT/MANIFEST.txt")"

tar -C "$HOME" -czf "$OUT.tar.gz" "$(basename "$OUT")" && rm -rf "$OUT"
echo
echo "DONE -> $OUT.tar.gz ($(du -h "$OUT.tar.gz" | cut -f1))"
echo "Copy it to your PC, then delete it from the server:  rm $OUT.tar.gz"
