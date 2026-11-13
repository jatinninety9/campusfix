#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

target_sha="${1:-}"

if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: Provide a full 40-character Git commit SHA."
  exit 1
fi

if [[ "$(id -un)" != "ubuntu" ]]; then
  echo "ERROR: Run this script as ubuntu."
  exit 1
fi

cd /home/ubuntu/campusfix

# Prevent overlapping deployments on this server.
mkdir -p /home/ubuntu/.local/state/campusfix
exec 9>/home/ubuntu/.local/state/campusfix/deploy.lock
flock -n 9 || {
  echo "ERROR: Another deployment is running."
  exit 1
}

compose=(
  sudo docker compose
  -f compose.ec2.yaml
  -f compose.https.yaml
  -f compose.pgadmin.yaml
  -f compose.gateway.yaml
)

"${compose[@]}" config --quiet

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ERROR: Tracked production files have uncommitted changes."
  exit 1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERROR: Production checkout must be on main."
  exit 1
fi

git fetch origin main
git cat-file -e "${target_sha}^{commit}"
git merge-base --is-ancestor "$target_sha" origin/main
git merge-base --is-ancestor HEAD "$target_sha"

previous_sha="$(git rev-parse HEAD)"
release_id="$(date -u +%Y%m%dT%H%M%SZ)-${target_sha:0:12}"
backup_dir="/home/ubuntu/.local/state/campusfix/releases/$release_id"
mkdir -p "$backup_dir"

printf '%s\n' "$previous_sha" > "$backup_dir/previous-commit"
printf '%s\n' "$target_sha" > "$backup_dir/target-commit"

for service in api web; do
  container_id="$("${compose[@]}" ps -q "$service")"
  test -n "$container_id"

  image_id="$(sudo docker inspect \
    --format '{{.Image}}' "$container_id")"

  sudo docker image tag \
    "$image_id" "campusfix-${service}:rollback-${release_id}"
done

"${compose[@]}" exec -T db \
  pg_dump -U campusfix -d campusfix -Fc \
  > "$backup_dir/database.dump"

test -s "$backup_dir/database.dump"

# Source files must remain readable by non-root container users. Keep the
# restrictive outer umask for recovery files, but not for Git's checkout.
(
  umask 022
  git merge --ff-only "$target_sha"
)
test "$(git rev-parse HEAD)" = "$target_sha"

# Build before replacing the running application containers.
"${compose[@]}" build api web

echo "Recovery files: $backup_dir"

"${compose[@]}" up -d \
  --no-deps --force-recreate \
  --wait --wait-timeout 180 api web

curl --fail --silent --show-error \
  --retry 5 --retry-delay 3 --retry-connrefused \
  --max-time 20 \
  http://127.0.0.1:8095/api/health

printf '\nDeployment completed: %s\n' "$target_sha"
"${compose[@]}" ps
