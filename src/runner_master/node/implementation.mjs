import {default as createNodeWorker} from "@anio-js-foundation/create-worker"
import runner_slave_code from "includeStaticResource:../../../dist/runner_slave/index.mjs"
import getConcreteNodeVersion from "./getConcreteNodeVersion.mjs"

let global_workers = new Map()

let node_binary = "node"

let reported_progress = []

async function init(context) {
	const {sendRequest} = context

	if ("version" in context.options) {
		setTimeout(async () => {
			const {binary, concrete_version} = await getConcreteNodeVersion(
				context.jtest_session.cache_dir,
				context.options.version,
				// download progress reporter
				(node_version, percentage) => {
					//
					// report progress in 25% chunks
					//
					let progress = Math.floor((percentage / 100) * 4) * 25

					//
					// do not report same progress more than once
					//
					if (reported_progress.includes(progress)) {
						return
					}

					sendRequest({
						cmd: "reportString",
						string: `Node ${node_version} download progress at ${progress}%`
					})

					reported_progress.push(progress)
				}
			)

			node_binary = binary

			// signal we are ready once the node binary
			// is downloaded and ready
			sendRequest({cmd: "ready", dynamic_props: {
				node_binary,
				concrete_version
			}})
		}, 0)

		return {
			requested_version: context.options.version
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
