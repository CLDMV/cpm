#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { CustomHelp, gatherCommands } from "./lib/util/CustomHelp.mjs";

const program = new Command();
program.createHelp = () => new CustomHelp();
program
	.name("cpm")
	.description(
		"Custom CLI with flexible help. Custom CLI with flexible help. Custom CLI with flexible help. Custom CLI with flexible help. Custom CLI with flexible help. Custom CLI with flexible help."
	)
	.configureOutput({
		writeErr: (str) => {} // Suppress default error output
	})
	.exitOverride();

await gatherCommands(program);

// Show global help if no arguments are provided (idiomatic Commander way)
program.action(() => {
	program.outputHelp();
	process.exit(0);
});

/**
 * Global uncaught exception handler for the CLI.
 * Prints error objects with all properties for debugging, including non-enumerable and symbol properties.
 * Intercepts prompt force-close errors (even if not instanceof Error) and exits cleanly.
 * @param {any} error - The uncaught exception.
 */
process.on("uncaughtException", (error) => {
	// Intercept ExitPromptError (inquirer) and similar prompt force-close errors
	if (
		(error instanceof Error && error.name === "ExitPromptError") ||
		(error && typeof error === "object" && typeof error.message === "string" && error.message.includes("User force closed the prompt"))
	) {
		console.log("👋 until next time!");
		process.exit(0);
	} else {
		/* 
		console.log("error object (util.inspect):");
		console.log(util.inspect(error, { showHidden: true, depth: null, colors: true }));
		// Print all own properties, including non-enumerable and symbol properties
		const allProps = {};
		if (error && typeof error === "object") {
			for (const key of Reflect.ownKeys(error)) {
				allProps[key] = error[key];
			}
			console.log("error own properties:", util.inspect(allProps, { showHidden: true, depth: null, colors: true }));
		}
		console.log("typeof error: ", typeof error);
		*/
		// Rethrow unknown errors
		throw error;
	}
});

try {
	program.parse(process.argv);
} catch (err) {
	// Global handler for inquirer prompt force-close (Ctrl+C, window close, etc.)
	if (err && err.message && err.message.includes("User force closed the prompt")) {
		console.log("\n[!] Exiting.");
		process.exit(0);
	}
	if (err.code === "commander.missingArgument" || err.code === "commander.unknownOption" || err.code === "commander.unknownCommand") {
		let helpShown = false;
		if (err.command && typeof err.command.outputHelp === "function") {
			err.command.outputHelp();
			helpShown = true;
		} else if (process.argv[2]) {
			const sub = program.commands.find((cmd) => {
				if (cmd.name() === process.argv[2]) return true;
				if (Array.isArray(cmd.aliases) && cmd.aliases.includes(process.argv[2])) return true;
				return false;
			});
			if (sub && typeof sub.outputHelp === "function") {
				sub.outputHelp();
				helpShown = true;
			}
		}
		if (!helpShown) {
			program.outputHelp();
		}
		console.error(chalk.red(`\n${err.message.trim()}`));
		process.exit(1);
	} else if (err.code === "commander.help") {
		// Help was shown, just exit cleanly
		process.exit(0);
	} else {
		// For other errors, rethrow or handle as needed
		throw err;
	}
}
