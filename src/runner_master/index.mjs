import browser_implementation from "../../dist/runner_master/browser/implementation.mjs"
import node_implementation from "../../dist/runner_master/node/implementation.mjs"

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
	this.requestHandler = requestHandler

	context = {
		type,
		options,
		sendRequest: this.sendRequest,
		jtest_session: null,
		// set the appopriate implementation
		implementation: type === "browser" ? browser_implementation : node_implementation
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
