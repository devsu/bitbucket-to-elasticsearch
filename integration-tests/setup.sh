#!/usr/bin/env sh

waitUntilHealthy() {
  COMMAND="docker inspect -f \"{{.State.Health.Status}}\" $(docker-compose ps -q $1)"
  HEALTH_STATUS=$(eval ${COMMAND})
  while [ "${HEALTH_STATUS}" != "healthy" ]; do
    echo "Service is not ready yet"
    sleep 1
    HEALTH_STATUS=$(eval ${COMMAND})
  done
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
