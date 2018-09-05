#!/usr/bin/env sh

DIR="$(dirname "$0")"
currentDir=$(pwd)
cd $DIR

echo "Tearing down test environment"
docker-compose down -v

cd $currentDir
