import {createServer} from "@anio-node-foundation/create-remote-worker"
import httpRequestHandler from "./httpRequestHandler.mjs"

let runner_client_id = null, server = null

async function init(context) {
	const {http_port} = context.options
	const {sendRequest} = context

	server = await createServer(http_port, "/endpoint", (request, response) => {
		return httpRequestHandler(context, request, response)
	})

	server.on("connect", client => {
		client.requestHandler = async (request) => {
			if (request.cmd === "startButtonClicked") {
				// register this client as the runner
				runner_client_id = client.connection_id

				return await sendRequest({
					cmd: "ready"
				})
			}
			// relay test results back to worker
			else if (request.cmd === "reportTestResult") {
				return await sendRequest(request)
			}
		}
	})

	return {
		port: server.port
	}
}

function getRunner() {
	if (runner_client_id === null) {
		throw new Error(`Cannot createWorker() when there's no client connected.`)
	}

	return server.getClientById(runner_client_id)
}

async function createWorker(context) {
	const {jtest_session} = context

	return await getRunner().sendRequest({
		cmd: "createWorker",
		jtest_session
	})
}

async function runTestInWorker(context, worker_id, test) {
	return await getRunner().sendRequest({
		cmd: "worker:runTest",
		worker_id,
		...test
	})
}

async function terminateWorker(context, worker_id) {
	return await getRunner().sendRequest({
		cmd: "terminateWorker",
		worker_id
	})
}

export default {
	init,
	createWorker,
	runTestInWorker,
	terminateWorker
}
