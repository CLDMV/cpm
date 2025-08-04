/**
 * provider.mjs
 * Centralized utility to call provider command methods (install, uninstall, etc) on all registered providers.
 */
import { getSources } from "./config.mjs";

/**
 * Calls the specified command method on all registered providers.
 * @param {string} method - The command method to call (e.g., 'install', 'uninstall').
 * @param {object} opts - Options to pass to the provider command method.
 * @returns {Promise<void>}
 * @example
 * await provider.runCommand("install", { package: "foo" });
 */
export async function runCommand(method, opts) {
	// Use getSources from config.mjs to get all loaded provider modules
	const allProviders = getSources();
	for (const provider of allProviders) {
		if (typeof provider.command?.[method] === "function") {
			await provider.command[method](opts);
		}
	}
}

/**
 * Installs a package using all providers.
 * @param {object} opts - Options for install (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await install({ package: "foo" });
 */
export async function install(opts) {
	await runCommand("install", opts);
}

/**
 * Publishes a package using all providers.
 * @param {object} opts - Options for publish (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await publish({ package: "foo" });
 */
export async function publish(opts) {
	await runCommand("publish", opts);
}

/**
 * Unpublishes a package using all providers.
 * @param {object} opts - Options for unpublish (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await unpublish({ package: "foo" });
 */
export async function unpublish(opts) {
	await runCommand("unpublish", opts);
}

/**
 * Uninstalls a package using all providers.
 * @param {object} opts - Options for uninstall (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await uninstall({ package: "foo" });
 */
export async function uninstall(opts) {
	await runCommand("uninstall", opts);
}

/**
 * Gets the version of a package using all providers.
 * @param {object} opts - Options for version (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await version({ package: "foo" });
 */
export async function version(opts) {
	await runCommand("version", opts);
}

/**
 * Updates a package using all providers.
 * @param {object} opts - Options for update (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await update({ package: "foo" });
 */
export async function update(opts) {
	await runCommand("update", opts);
}

/**
 * Initializes a package using all providers.
 * @param {object} opts - Options for init (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await init({ package: "foo" });
 */
export async function init(opts) {
	await runCommand("init", opts);
}
