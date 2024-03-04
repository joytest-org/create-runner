import errorObjectToString from "@anio-js-foundation/error-object-to-string"

let context = {
	jtest_session: null,
	environment: null,
	sendRequest: null
}

// environment can either be 'browser' or 'node'
export async function AnioJTestWorkerMain(environment, jtest_session = null) {
	if (!["node", "browser"].includes(environment)) {
		throw new Error(`Invalid environment "${environment}".`)
	} else if (jtest_session === null) {
		throw new Error(`AnioJTestWorkerMain: jtest_session cannot be null and must be supplied.`)
	}

	this.requestHandler = requestHandler

	context.jtest_session = jtest_session
	context.environment = environment
	context.sendRequest = this.sendRequest
}

function reportResult(report) {
	context.sendRequest({
		cmd: "reportTestResult",
		report
	})
}

async function loadTestSuite(url) {
	if (context.environment === "browser") {
		return (await import("/project_files/" + url)).default
	}

	const {default: path} = await import("node:path")

	return (await import(
		// path.resolve turns "/bla/bla/" "/test" into "/test" and not "/bla/bla/test"
		path.join(context.jtest_session.options.project_root, url)
	)).default
}

async function requestHandler(msg) {
	if (msg.cmd === "runTest") {
		const {url, test_id, result_id, timeout} = msg

		setTimeout(async () => {
			try {
				const suite = await loadTestSuite(url)
				const test = suite.findTestById(test_id)

				if (test.skip) {
					reportResult({
						result_id, error: false, result: {
							verdict: "skipped"
						}
					})

					return
				}

				const result = await test.run(timeout, {
					environment: context.environment,
					jtest_session: context.jtest_session
				})

				reportResult({
					result_id, error: false, result
				})
			} catch (error) {
				reportResult({
					result_id, error: true, result: errorObjectToString(error)
				})
			}
		}, 0)

		return "dispatched"
	}
}
