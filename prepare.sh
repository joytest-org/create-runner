#!/bin/bash -eufx

./node_modules/.bin/bundle-package . \
	runner_slave/index.mjs \
	runner_master/browser/client/index.mjs \
	runner_master/browser/implementation.mjs \
	runner_master/node/implementation.mjs \
	runner_master/index.mjs
