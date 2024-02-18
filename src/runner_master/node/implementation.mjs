import {default as createNodeWorker} from "@anio-js-foundation/create-worker"
import runner_slave_code from "includeStaticResource:../../runner_slave/index.mjs"

let global_workers = new Map()

async function init(context) {
	const {sendRequest} = context

	setTimeout(() => {
		sendRequest({cmd: "ready"})
	}, 0)

	return {}
}

async function createWorker(context) {
	const {jtest_session, sendRequest} = context

	const node_binary = "node_binary" in context.options ? context.options.node_binary : "node"

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
	const {url, test_id, result_id} = test
	const target_worker = global_workers.get(worker_id)

	return await target_worker.sendRequest({
		cmd: "runTest",
		url,
		test_id,
		result_id
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
