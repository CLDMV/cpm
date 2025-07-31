/**
 * Handler for the --installsource CLI command.
 */
import configUtil from "./util/config.mjs";
import chalk from "chalk";

/**
 * Handler for the --installsource CLI command.
 * Uses configUtil API for config operations.
 * @param {Object} argv - The parsed CLI arguments.
 * @returns {Promise<void>}
 */
export default async function installSource(argv) {
	const sourceName = argv.installsource;
	let sources = await configUtil.get("sources");
	if (!Array.isArray(sources)) sources = [];
	if (!sources.includes(sourceName)) {
		sources.push(sourceName);
		await configUtil.set("sources", sources);
		console.log(chalk.green(`[+] Source '${sourceName}' added to config.`));
	} else {
		console.log(chalk.yellow(`[!] Source '${sourceName}' already present in config.`));
	}
}
