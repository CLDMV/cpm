import configUtil from "../../util/config.mjs";
import npmUtil from "../../util/npm.mjs";
import chalk from "chalk";

/**
 * Installs a provider module via npm and adds it to the config if successful.
 * If the provider exposes a command.install, prefer that in the future.
 * @param {Object} argv - The parsed CLI arguments.
 * @returns {Promise<void>}
 * @example
 * await installProvider({ provider: "cpm-github" });
 */
export default async function installProvider(argv) {
	const providerName = argv.provider;
	let sources = await configUtil.get("sources");
	if (!Array.isArray(sources)) sources = [];
	if (sources.includes(providerName)) {
		console.log(chalk.yellow(`[!] Provider '${providerName}' already present in config.`));
		return;
	}

	console.log(chalk.cyan(`[~] Installing npm module '${providerName}'...`));
	const ok = await npmUtil.install(providerName);
	if (!ok) {
		console.log(chalk.red(`[!] Failed to install npm module '${providerName}'. Please check the package name and try again.`));
		return;
	}

	sources.push(providerName);
	await configUtil.set("sources", sources);
	console.log(chalk.green(`[+] Provider '${providerName}' added to config.`));
}
