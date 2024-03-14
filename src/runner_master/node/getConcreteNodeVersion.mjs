import {
	getAvailableVersions,
	getVersionFromSpecifier,
	download
} from "@anio-node-foundation/get-nodejs-binaries"

import path from "node:path"
import fs from "node:fs/promises"

import nodeFsUtils from "@anio-node-foundation/fs-utils"

async function updateLocalAvailableVersionsFile(cache_dir) {
	const versions_file = path.join(cache_dir, "node_versions.json")

	try {
		const available_versions = await getAvailableVersions()

		await nodeFsUtils.writeAtomicFile(
			versions_file, JSON.stringify(available_versions, null, 4)
		)
	} catch {}

	const file_contents = await fs.readFile(versions_file)

	return JSON.parse(file_contents)
}

async function provideConcreteVersion(
	cache_dir,
	version,
	reportDownloadProgress
) {
	const cache_path = path.join(cache_dir, `${version}`, "bin", "node")

	if (await nodeFsUtils.isFile(cache_path)) {
		return cache_path
	}

	const tmp = await download(version, (percentage) => {
		// add concrete version to progress reporting
		reportDownloadProgress(version, percentage)
	})

	await fs.mkdir(path.join(cache_dir, `${version}.tmp`, "bin"), {
		recursive: true
	})

	await fs.rename(
		path.join(tmp.path, "bin", "node"),
		path.join(cache_dir, `${version}.tmp`, "bin", "node")
	)

	await fs.rename(
		path.join(cache_dir, `${version}.tmp`),
		path.join(cache_dir, `${version}`)
	)

	return cache_path
}

export default async function(
	cache_dir,
	node_version,
	reportDownloadProgress
) {
	const available_versions = await updateLocalAvailableVersionsFile(cache_dir)
	const concrete_version = getVersionFromSpecifier(available_versions, node_version)

	return {
		binary: await provideConcreteVersion(
			cache_dir,
			concrete_version,
			reportDownloadProgress
		),
		concrete_version
	}
}
