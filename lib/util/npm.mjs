/**
 * Utility object for npm operations.
 */
const npmUtil = {
	/**
	 * Attempts to install an npm module synchronously.
	 * @param {string} moduleName - The npm package name to install.
	 * @returns {Promise<boolean>} True if install succeeded, false otherwise.
	 * @example
	 * const ok = await npmUtil.install("cpm-github");
	 */
	async install(moduleName) {
		const { spawnSync } = await import("child_process");
		const result = spawnSync("npm", ["install", moduleName, "--no-save"], {
			stdio: "inherit",
			env: process.env
		});
		return !result.error && result.status === 0;
	}
};

export default npmUtil;
