#!/usr/bin/env bash

DIR="$(dirname "$0")"

printf "\n\t -- Running Integration Tests --\n\n"

"${DIR}/setup.sh"
"${DIR}/../node_modules/jest/bin/jest.js" --runInBand -c "${DIR}/../jest.config.integration.js"
STATUS=$?
"${DIR}/teardown.sh"
exit ${STATUS}