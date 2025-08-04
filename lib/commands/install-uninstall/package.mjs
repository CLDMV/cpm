/**
 * install-uninstall/package.mjs
 * Handles install and uninstall actions for packages by delegating to all registered providers.
 */
import * as provider from "../../util/provider.mjs";

/**
 * Installs a package using all registered providers via the centralized provider utility.
 * @param {object} opts - Options for install (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await install({ package: "foo" });
 */
export async function install(opts) {
	await provider.install(opts);
}

/**
 * Uninstalls a package using all registered providers via the centralized provider utility.
 * @param {object} opts - Options for uninstall (e.g., { package: "foo" })
 * @returns {Promise<void>}
 * @example
 * await uninstall({ package: "foo" });
 */
export async function uninstall(opts) {
	await provider.uninstall(opts);
}
