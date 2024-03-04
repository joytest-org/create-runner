import {default as createNodeWorker} from "@anio-js-foundation/create-worker"
import runner_slave_code from "includeStaticResource:../../../dist/runner_slave/index.mjs"
import getNodeBinaryPath from "./getNodeBinaryPath.mjs"

let global_workers = new Map()

let node_binary = "node"

async function init(context) {
	const {sendRequest} = context

	if ("version" in context.options) {
		setTimeout(async () => {
			node_binary = await getNodeBinaryPath(
				context.jtest_session.cache_dir, context.options.version
			)

			// signal we are ready once the node binary
			// is downloaded and ready
			sendRequest({cmd: "ready"})
		}, 0)

		return {
			version: context.options.version
		}
	}

	if ("node_binary" in context.options) {
		node_binary = context.options["node_binary"]
	}

	// nothing needs to be done if the node binary
	// is already present on the system
	setTimeout(() => {
		sendRequest({cmd: "ready"})
	}, 0)

	return {
		node_binary
	}
}

async function createWorker(context) {
	const {jtest_session, sendRequest} = context

	const worker = await createNodeWorker.fromCode(
		runner_slave_code, ["node", jtest_session], "AnioJTestWorkerMain", {
			silent: false,
			node_binary
		}
	)

	worker.requestHandler = async (request) => {
		// relay test results back to worker
		if (request.cmd === "reportTestResult") {
			return await sendRequest(request)
		}
	}

	global_workers.set(worker.connection_id, worker)

	return worker.connection_id
}

async function runTestInWorker(context, worker_id, test) {
	const target_worker = global_workers.get(worker_id)

	return await target_worker.sendRequest({
		cmd: "runTest",
		...test
	})
}

async function terminateWorker(context, worker_id) {
	const target_worker = global_workers.get(worker_id)

	target_worker.terminate()

	global_workers.delete(worker_id)
}

export default {
	init,
	createWorker,
	runTestInWorker,
	terminateWorker
}
