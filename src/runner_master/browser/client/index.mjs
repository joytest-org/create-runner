import {createClient} from "@anio-js-foundation/create-remote-worker"
import {default as createWebWorker} from "@anio-js-foundation/create-worker"

function logLineRaw(line, highlight = false) {
	const log = document.querySelector(".log")

	if (highlight) {
		log.innerHTML += `<span class="highlight">${line}</span>`
	} else {
		log.innerHTML += `<span>${line}</span>`
	}

	log.scrollTop = log.scrollHeight
}

function logLine(line, highlight = false) {
	logLineRaw(`${Date.now()} ${line}`, highlight)
}

const runner_master = await createClient(
	`${document.location.origin}/endpoint`, requestHandler
)

window.global_worker = {}

async function createWorker(jtest_session) {
	const web_worker_main = `${document.location.origin}/runner_slave.mjs`

	const worker = await createWebWorker(
		web_worker_main, ["browser", jtest_session], "AnioJTestWorkerMain", {
			importmap: {
				imports: {
					// todo: include importmap from jtest_session
					"@anio-jtest/test": document.location.origin + "/project_files/node_modules/@anio-jtest/test/dist/package.mjs"
				}
			}
		}
	)

	worker.requestHandler = async (request) => {
		console.log("worker.requestHandler", request)

		logLine(`got result ${JSON.stringify(request).split(`"pass"`).join(`<span class="green">"pass"</span>`)}`)

		return await runner_master.sendRequest(request)
	}

	return {
		id: worker.connection_id,
		async sendRequest(...args) {
			return await worker.sendRequest(...args)
		},
		async terminate() {
			return await worker.terminate()
		}
	}
}

async function requestHandler(req) {
	if (req.cmd === "createWorker") {
		const worker = await createWorker(req.jtest_session)

		logLine(`created worker '${worker.id}'`)

		global_worker[worker.id] = worker

		logLine(`number of workers '${Object.keys(global_worker).length}'`)

		return worker.id

	} else if (req.cmd === "terminateWorker") {

		const worker_obj = global_worker[req.worker_id]

		logLine(`terminate worker '${req.worker_id.slice(0, 6)}'`)

		worker_obj.terminate()

		if (!(req.worker_id in global_worker)) {
			console.log("NOT FOUND", req.worker_id)
		}

		delete global_worker[req.worker_id]

		logLine(`number of workers remaining '${Object.keys(global_worker).length}'`)

		return `killed ${req.worker_id}`
	} else if (req.cmd === "worker:runTest") {
		const {worker_id, url, test_id, result_id, timeout} = req

		let target_worker = global_worker[worker_id]

		logLine(`dispatching test ${test_id} to worker ${worker_id} (result_id=${result_id})`)

		logLineRaw(`Run ${req.test_id}`,true)

		return await target_worker.sendRequest({
			cmd: "runTest",
			url,
			test_id,
			result_id,
			timeout
		})
	} else {
		/* invalid request */
	}

	return 0
}

document.querySelector("#start").addEventListener("click", (e) => {
	runner_master.sendRequest({
		cmd: "startButtonClicked"
	})
})
