import createWorker from "@anio-js-foundation/create-worker"
import createPromise from "@anio-js-core-foundation/create-promise"
import createRandomIdentifier from "@anio-js-core-foundation/create-random-identifier"

import runner_master_code from "includeStaticResource:../dist/runner_master/index.mjs"

/*
	runner <- ipc -> runner_master <- | http | -> runner_slave [<-> worker]
*/
export default async function createRunner(type, options) {
	if (!["node", "browser"].includes(type)) {
		throw new Error(`Invalid runner type "${type}".`)
	}

	let instance = {
		is_ready: false,
		ready_promise: createPromise(),
		pending_tests: new Map(),

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
			const {result_id, result, error} = request.report

			if (!instance.pending_tests.has(result_id)) {
				return
			}

			if (error === false) {
				instance.pending_tests.get(result_id).resolve(result)
			} else {
				instance.pending_tests.get(result_id).reject(
					// result contains error message as a string
					new Error(`${result}`)
				)
			}
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
			runTest(test_id, timeout = 0) {
				const url = test_id.slice(0, test_id.lastIndexOf("#d"))

				const result_id = createRandomIdentifier(8)

				instance.pending_tests.set(result_id, createPromise())

				// test result will be delivered asynchronously
				runner_master.sendRequest({
					cmd: "runner:worker:runTest",
					worker_id,
					url,
					test_id,
					result_id,
					timeout
				})

				return instance.pending_tests.get(result_id).promise
			},

			async terminate() {
				await runner_master.sendRequest({
					cmd: "runner:terminateWorker",
					worker_id
				})
			}
		}
	}

	//
	//
	//
	instance.public_interface.runTestUnitsFactory = function (test_units, timeout_value = 0, event_handler = () => {}) {
		let ret = []

		for (const test_unit of test_units) {
			// make a copy of the units
			// because the function will shift() tests from the units
			// array, modifying the original array
			const test_unit_copy = JSON.parse(JSON.stringify(test_unit))

			ret.push(async () => {
				let test_results_map = new Map()

				const setTestResult = (test_id, result) => {
					test_results_map.set(test_id, result)
					event_handler("test_result", {test_id, result})
				}

				let current_test

				//
				// .createWorker() can fail
				// and we need to handle that case
				//
				try {
					// every unit is processed in its own worker
					const worker = await instance.public_interface.createWorker()

					//
					// process each test separately
					// so we can assign the test result accordingly
					//
					while (current_test = test_unit_copy.shift()) {
						try {
							event_handler("before_run", current_test.id)
							const test_result = await worker.runTest(current_test.id, timeout_value)
							event_handler("after_run", current_test.id)

							setTestResult(current_test.id, {
								has_error_occurred_during_testing: false,
								...test_result
							})
						} catch (error) {
							setTestResult(current_test.id, {
								has_error_occurred_during_testing: true,
								error
							})
						}
					}

					await worker.terminate()
				} catch (error) {
					//
					// mark all tests all failed
					//
					while (current_test = test_unit_copy.shift()) {
						setTestResult(current_test.id, {
							has_error_occurred_during_testing: true,
							error
						})
					}
				}

				return test_results_map
			})
		}

		return ret
	}

	return instance.public_interface
}
