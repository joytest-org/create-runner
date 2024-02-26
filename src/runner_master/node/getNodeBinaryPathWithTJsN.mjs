import createTemporaryResource from "@anio-js-foundation/create-temporary-resource"
import {execFileSync} from "node:child_process"
import n_bin_code from "includeStaticResource:./n.bin"

export default async function(cache_dir, node_version) {
	const {location, cleanup} = await createTemporaryResource(
		n_bin_code
	)

	execFileSync(
		"/bin/bash", [
			location,
			"install",
			node_version
		], {
			stdio: ["pipe", "pipe", "inherit"],
			env: {
				...process.env,
				N_PREFIX: cache_dir
			}
		}
	)

	return execFileSync(
		"/bin/bash", [
			location,
			"which",
			node_version
		], {
			stdio: "pipe",
			env: {
				...process.env,
				N_PREFIX: cache_dir
			}
		}
	).toString().trim()
}
