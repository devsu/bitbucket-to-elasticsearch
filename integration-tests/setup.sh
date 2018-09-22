#!/usr/bin/env sh

waitUntilHealthy() {
  COMMAND="docker inspect -f \"{{.State.Health.Status}}\" $(docker-compose ps -q $1)"
  HEALTH_STATUS=$(eval ${COMMAND})
  CURRENT_TRIES=0
  MAX_TRIES=30
  while [ "${HEALTH_STATUS}" != "healthy" -a "${CURRENT_TRIES}" -lt "${MAX_TRIES}" ]; do
    echo "Service is not ready yet"
    sleep 1
    HEALTH_STATUS=$(eval ${COMMAND})
    CURRENT_TRIES=$[CURRENT_TRIES + 1]
  done
  if [ "${HEALTH_STATUS}" != "healthy" ]; then
    echo "Timeout waiting service"
    exit 1
  fi
  echo "Service is ready"
  unset HEALTH_STATUS
}

DIR="$(dirname "$0")"
currentDir=$(pwd)
cd $DIR

echo "Starting docker containers"
docker-compose up -d
waitUntilHealthy "elasticsearch"

cd $currentDir
