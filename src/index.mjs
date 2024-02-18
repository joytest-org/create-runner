import createWorker from "@anio-js-foundation/create-worker"
import createPromise from "@anio-js-core-foundation/create-promise"
import createRandomIdentifier from "@anio-js-core-foundation/create-random-identifier"

import runner_master_code from "includeStaticResource:../dist/runner_master/index.mjs"

/*
	runner <- ipc -> runner_master <- | http | -> runner_slave [<-> worker]
*/
export default async function createRunner(type, options) {
	let instance = {
		is_ready: false,
		ready_promise: createPromise(),
		test_results: new Map(),

		public_interface: {
			type
		}
	}

	const runner_master = await createWorker.fromCode(runner_master_code, [
		type, options
	], "RunnerMasterMain", {
		silent: false
	})

	runner_master.requestHandler = (request) => {
		if (request.cmd === "ready") {
			instance.is_ready = true
			instance.ready_promise.resolve()
		} else if (request.cmd === "reportTestResult") {
			const {result_id, result} = request.report

			instance.test_results.get(result_id).resolve(result)
		} else {
			/* unknown request */
		}
	}

	instance.public_interface.id = runner_master.connection_id

	instance.public_interface.init = async function init(jtest_session) {
		let new_props = await runner_master.sendRequest({
			cmd: "init",
			jtest_session
		})

		for (const key in new_props) {
			if (key in instance.public_interface) {
				throw new Error(`Cannot set property '${key}' because it is already set. This is a bug.`)
			}

			instance.public_interface[key] = new_props[key]
		}

		return new_props
	}

	instance.public_interface.ready = async function ready() {
		return await instance.ready_promise.promise
	}

	instance.public_interface.terminate = async function terminate() {
		runner_master.terminate()
	}

	instance.public_interface.createWorker = async function createWorker() {
		if (!instance.is_ready) {
			throw new Error(`Cannot create worker when we're not ready!`)
		}

		const worker_id = await runner_master.sendRequest({
			cmd: "runner:createWorker"
		})

		return {
			id: worker_id,

			// todo: implement timeout
			async runTest(test_id, timeout = 0) {
				const url = test_id.slice(0, test_id.lastIndexOf("#d"))

				const result_id = createRandomIdentifier(8)

				instance.test_results.set(result_id, createPromise())

				// test result will be delivered asynchronously
				await runner_master.sendRequest({
					cmd: "runner:worker:runTest",
					worker_id,
					url,
					test_id,
					result_id
				})

				return await instance.test_results.get(result_id).promise
			},

			async terminate() {
				await runner_master.sendRequest({
					cmd: "runner:terminateWorker",
					worker_id
				})
			}
		}
	}

	return instance.public_interface
}
