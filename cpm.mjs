#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * Entrypoint.
 * Uses yargs for CLI argument parsing. Shows config UI only if --config is passed.
 * @returns {Promise<void>}
 */
async function main() {
	const argv = yargs(hideBin(process.argv))
		.option("config", {
			alias: "c",
			type: "boolean",
			description: "Open interactive config UI"
		})
		.option("installsource", {
			type: "string",
			description: "Add a new source to the config"
		})
		.help().argv;

	if (argv.installsource) {
		const { default: installSource } = await import("./lib/installsource.mjs");
		await installSource(argv);
		process.exit(0);
	}

	if (argv.config) {
		const { default: configUI } = await import("./lib/config.mjs");
		await configUI();
		process.exit(0);
	}

	// Future: handle other CLI commands here
	yargs.showHelp();
	process.exit(0);
}

// Gracefully handle ctrl+c or force-closed prompt errors
async function runMain() {
	try {
		await main();
	} catch (error) {
		if (
			error &&
			error instanceof Error &&
			(error.name === "ExitPromptError" || (typeof error.message === "string" && error.message.includes("User force closed the prompt")))
		) {
			console.log("👋 until next time!");
			process.exit(0);
		} else {
			throw error;
		}
	}
}

runMain();
