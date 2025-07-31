import chalk from "chalk";
import { loadConfig, saveConfig } from "../cpm.mjs";

export default async function installSource(argv) {
	const config = await loadConfig();
	const sourceName = argv.installsource.replace(/^cpm-/, "");
	if (!config.sources) config.sources = ["github", "npm"];
	if (!config.sources.includes(sourceName)) {
		config.sources.push(sourceName);
		if (!config.global[sourceName]) config.global[sourceName] = {};
		for (const ns of Object.keys(config.namespaces)) {
			if (!config.namespaces[ns][sourceName]) config.namespaces[ns][sourceName] = {};
		}
		saveConfig(config);
		console.log(chalk.green(`[+] Source '${sourceName}' added to config.`));
	} else {
		console.log(chalk.yellow(`[!] Source '${sourceName}' already present in config.`));
	}
}
