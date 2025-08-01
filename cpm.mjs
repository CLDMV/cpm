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

// Listen for terminal resize and re-output help if in interactive terminal
if (process.stdout.isTTY) {
	let lastColumns = process.stdout.columns;
	process.stdout.on("resize", () => {
		// Only re-output help if columns actually changed
		if (process.stdout.columns !== lastColumns) {
			lastColumns = process.stdout.columns;
			// Only re-output help if no subcommand is running (i.e. just showing help)
			// This is a simple heuristic: if no extra args, show help again
			if (process.argv.length <= 2 || (process.argv[2] === "help" && process.argv.length <= 3)) {
				// Clear the terminal for a cleaner re-render
				process.stdout.write("\x1Bc");
				program.outputHelp();
			}
		}
	});
}

// Show global help if no arguments are provided (idiomatic Commander way)
program.action(() => {
	program.outputHelp();
	process.exit(0);
});

try {
	program.parse(process.argv);
} catch (err) {
	// console.log("try/catch error: ", err);
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
