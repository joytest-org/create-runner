import browser_implementation from "@joytest/create-browser-runner"
import node_implementation from "@joytest/create-node-runner"

let context = null

//
// RunnerMasterMain
//
// 'type' is either going to be 'browser' or 'node'
//
// options contains http-port for 'browser' and path to node
// binary for 'node'
//
export async function RunnerMasterMain(type, options) {
	// set the appopriate implementation
	let implementation = ""

	switch (type) {
		case "browser":
			implementation = browser_implementation
		break

		case "node":
			implementation = node_implementation
		break

		default:
			throw new Error(`No implementation for type '${type}'.`)
	}

	this.requestHandler = requestHandler

	context = {
		type,
		options,
		sendRequest: this.sendRequest,
		jtest_session: null,
		implementation
	}
}

async function requestHandler(req) {
	if (req.cmd === "init") {
		context.jtest_session = req.jtest_session

		return await context.implementation.init(context)
	}
	else if (req.cmd === "runner:createWorker") {
		return await context.implementation.createWorker(context)
	}
	else if (req.cmd === "runner:worker:runTest") {
		const {worker_id, url, test_id, result_id, timeout} = req

		return await context.implementation.runTestInWorker(context, worker_id, {
			url, test_id, result_id, timeout
		})
	}
	else if (req.cmd === "runner:terminateWorker") {
		const {worker_id} = req

		return await context.implementation.terminateWorker(context, worker_id)
	}
}
