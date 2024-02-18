import fs from "node:fs"
import path from "node:path"

import index_html_code from "includeStaticResource:./client/index.html"
import index_js_code from "includeStaticResource:../../../dist/runner_master/browser/client/index.mjs"
import runner_slave_code from "includeStaticResource:../../runner_slave/index.mjs"

export default function(context, request, response) {
	const {jtest_session} = context

	if (request.url.startsWith("/project_files/")) {
		let file = fs.readFileSync(
			path.join(jtest_session.options.project_root, request.url.slice(
				"/project_files/".length
			))
		)

		response.setHeader("Content-Type", "text/javascript")
		response.write(file)
		response.end()
	}
	else if (request.url.startsWith("/package_contents/")) {
		let file = fs.readFileSync(
			path.join(jtest_session.package_root, request.url.slice(
				"/package_contents/".length
			))
		)

		response.setHeader("Content-Type", "text/javascript")
		response.write(file)
		response.end()
	}
	else if (request.url === "/index.mjs") {
		response.setHeader("Content-Type", "text/javascript")
		response.write(index_js_code)
		response.end()
	}
	else if (request.url === "/index.html") {
		response.setHeader("Content-Type", "text/html;charset=utf-8")
		response.write(index_html_code)
		response.end()
	}
	else if (request.url === "/runner_slave.mjs") {
		response.setHeader("Content-Type", "text/javascript")
		response.write(runner_slave_code)
		response.end()
	}
	else {
		response.write(`404 not found`)
		response.end()
	}
}
