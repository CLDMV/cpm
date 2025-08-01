import chalk from "chalk";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { Command, Help } from "commander";
/**
 * Adds a .examples() method to Commander Command prototype for getting/setting examples.
 *
 * Usage:
 *   cmd.examples(["ex1", "ex2"]) // sets examples
 *   cmd.examples() // gets examples array (or undefined)
 */
if (typeof Command.prototype.examples !== "function") {
	/**
	 * Get or set examples for the command.
	 * @param {string[]} [arr] - If provided, sets the examples array. If omitted, returns current examples.
	 * @returns {string[]|Command} Returns examples array if no argument, or the Command for chaining if setting.
	 * @example
	 * cmd.examples(["foo bar", "baz qux"]);
	 * cmd.examples(); // ["foo bar", "baz qux"]
	 */
	Command.prototype.examples = function (arr) {
		if (arguments.length === 0) return this.examples;
		this.examples = Array.isArray(arr) ? arr : [];
		return this;
	};
}
// Add .helpExampleCount() chainable method to Command prototype
if (typeof Command.prototype.helpExampleCount !== "function") {
	/**
	 * Set the number of examples to show in global help output.
	 * @param {number} count - Number of examples to show.
	 * @returns {Command} The command for chaining.
	 * @example
	 * program.helpExampleCount(8)
	 */
	Command.prototype.helpExampleCount = function (count) {
		this.exampleCount = typeof count === "number" ? count : 5;
		return this;
	};
}
/**
 * CustomHelp: Colorized and multi-line-aware help class for Commander.js.
 * Shows aliases on a new line in the description column for each command.
 * Color output can be forced, disabled, or auto-detected.
 * @public
 */
class CustomHelp extends Help {
	/**
	 * @param {object} [opts]
	 * @param {'auto'|'always'|'never'} [opts.colorMode]
	 */
	constructor(opts = {}) {
		super();
		/**
		 * @type {'auto'|'always'|'never'}
		 */
		this.colorMode = typeof opts.colorMode === "string" ? opts.colorMode : CustomHelp.ColorModes.AUTO;
		this.initColorMode();
	}

	/**
	 * Format help output with color and multi-line alias support.
	 * @param {import('commander').Command} cmd
	 * @param {import('commander').Help} helper
	 * @returns {string}
	 */
	formatHelp(cmd, helper) {
		const color = (fn, str) => {
			if (this.colorMode === CustomHelp.ColorModes.NEVER) return str;
			return fn(str);
		};

		// console.log("helper: ", helper);
		// console.log("cmd: ", cmd);

		let output = [];

		const fullChain = CustomHelp.getFullCommandChain(cmd);
		// Always generate usage line from command chain, arguments, and options
		const usageArgList = helper.visibleArguments(cmd);
		// Build a map of argument names and aliases to their color and type
		// Handles union args like <command|node_module>
		const argColorMap = {};
		for (const a of usageArgList) {
			const names = a
				.name()
				.split("|")
				.map((s) => s.trim());
			for (const n of names) {
				argColorMap[n] = {
					required: a.required,
					color: a.required ? chalk.magenta : chalk.yellow
				};
			}
		}
		let usageArgStr = usageArgList
			.map((a) => {
				const argStr = a.required ? `<${a.name()}>` : `[${a.name()}]`;
				const colorFn = a.required ? chalk.magenta : chalk.yellow;
				return color(colorFn, argStr);
			})
			.join(" ");
		// Only show [options] if there are options (excluding help)
		const usageOptionList = helper.visibleOptions(cmd).filter((o) => o.long !== "--help");
		let usageLine = `${fullChain}`;
		if (usageArgStr) usageLine += ` ${usageArgStr}`;
		if (usageOptionList.length) usageLine += " [options]";
		output.push(color(chalk.bold, "Usage:") + ` ${usageLine}`);
		output.push("");

		// Description: header, then description on its own line (no wrapping)
		if (cmd.description()) {
			output.push(color(chalk.bold, "Description:"));
			output.push(cmd.description());
			output.push("");
		}

		// Show aliases under usage line if not the global help command
		// (global help command is usually named 'help' or has no aliases)
		if (cmd._aliases && Array.isArray(cmd._aliases) && cmd._aliases.length > 0 && cmd.name() !== "help") {
			output.push(color(chalk.bold, "Aliases:"));
			for (const alias of cmd._aliases) {
				output.push(`  ${color(chalk.yellow, alias)}`);
			}
			output.push("");
		}

		// Commands (with subcommands shown under each primary command in global help)
		const commandList = helper.visibleCommands(cmd);
		if (commandList.length) {
			const isTopLevel = !cmd.parent;
			output.push(color(chalk.bold, isTopLevel ? "Commands:" : "Sub Commands:"));
			CustomHelp.printCommands(commandList, 1, output, color, helper);
		}

		// Options
		const optionList = helper.visibleOptions(cmd);
		if (optionList.length) {
			output.push(color(chalk.bold, "Options:"));
			const width = optionList.reduce((max, o) => {
				const term = helper.optionTerm(o);
				return Math.max(max, term.length);
			}, 0);
			for (const o of optionList) {
				const term = helper.optionTerm(o).padEnd(width);
				output.push(`  ${color(chalk.green, term)}  ${o.description}`);
			}
			output.push("");
		}

		// Arguments
		const argList = helper.visibleArguments(cmd);
		if (argList.length) {
			output.push(color(chalk.bold, "Arguments:"));
			for (const a of argList) {
				const isRequired = a.required;
				const argStr = isRequired ? `<${a.name()}>` : `[${a.name()}]`;
				const argColor = isRequired ? chalk.magenta : chalk.yellow;
				output.push(`  ${color(argColor, argStr)}`);
			}
			output.push("");
		}

		// Examples (for global help: gather from all commands, pick 5 random, colorize args)
		function getAllExamples(cmd) {
			let examples = [];
			if (Array.isArray(cmd.examples) && cmd.examples.length) {
				examples = examples.concat(cmd.examples);
			}
			if (cmd.commands && cmd.commands.length) {
				for (const sub of cmd.commands) {
					examples = examples.concat(getAllExamples(sub));
				}
			}
			return examples;
		}

		let exampleList = [];
		if (!cmd.parent) {
			// global help
			// Gather all examples from all commands
			let allExamples = getAllExamples(cmd);
			// Remove duplicates
			allExamples = Array.from(new Set(allExamples));
			// Allow configurable count via .exampleCount property on the root command
			let exampleCount = 5;
			let current = cmd;
			while (current && typeof current.exampleCount !== "number" && current.parent) {
				current = current.parent;
			}
			if (typeof current.exampleCount === "number") {
				exampleCount = current.exampleCount;
			}
			// Shuffle and pick exampleCount
			for (let i = allExamples.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[allExamples[i], allExamples[j]] = [allExamples[j], allExamples[i]];
			}
			exampleList = allExamples.slice(0, exampleCount);
		} else {
			if (Array.isArray(cmd.examples) && cmd.examples.length) {
				exampleList = cmd.examples.slice();
			}
			// Auto-generate examples for subcommands if not present
			if (cmd.commands && cmd.commands.length) {
				for (const sub of cmd.commands) {
					const subName = sub.name();
					const parentChain = CustomHelp.getFullCommandChain(cmd);
					let subExample = `$ ${parentChain} ${subName}`;
					const subArgs = (sub._args || []).map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`)).join(" ");
					if (subArgs) subExample += ` ${subArgs}`;
					if (!exampleList.some((e) => e.includes(subName))) {
						exampleList.push(subExample);
					}
				}
			}
		}
		if (exampleList.length) {
			output.push(color(chalk.bold, "Examples:"));
			// Regex to match <arg> and [arg] for any word inside
			const argPattern = /(<([\w|-]+)>)|(\[([\w|-]+)\])/g;
			for (const ex of exampleList) {
				// Colorize <arg> as magenta, [arg] as yellow
				let coloredEx = ex.replace(argPattern, (match, p1, p2, p3, p4) => {
					if (p2) return color(chalk.magenta, match);
					if (p4) return color(chalk.yellow, match);
					return match;
				});
				output.push(`  ${coloredEx}`);
			}
			output.push("");
		}

		// Help
		while (output.length > 0 && output[output.length - 1].trim() === "") {
			output.pop();
		}
		output.push(color(chalk.gray, "\nFor more information, use a command with help, --help, or -h."));

		output.push("");

		return output.join("\n");
	}

	/**
	 * Set color mode for help output.
	 * @param {'auto'|'always'|'never'} mode
	 */
	setColorMode(mode) {
		this.colorMode = mode;
		if (mode === CustomHelp.ColorModes.ALWAYS) {
			chalk.level = 3;
		} else if (mode === CustomHelp.ColorModes.NEVER) {
			chalk.level = 0;
		} else {
			// auto: let chalk decide based on environment
			// (do not override chalk.level)
		}
	}

	/**
	 * Check environment variables for color control and set color mode accordingly.
	 */
	initColorMode() {
		if (process.env.NO_COLOR) {
			this.setColorMode("never");
		} else if (process.env.FORCE_COLOR) {
			this.setColorMode("always");
		}
	}

	/**
	 * Color mode constants (static).
	 */
	static ColorModes = {
		AUTO: "auto",
		ALWAYS: "always",
		NEVER: "never"
	};

	// Static util methods must be inside the class body
	static getFullCommandChain(cmd) {
		const names = [];
		let current = cmd;
		while (current) {
			if (current.name && typeof current.name === "function") {
				const n = current.name();
				if (n) names.unshift(n);
			}
			current = current.parent;
		}
		return names.join(" ");
	}

	static wrapTextWithHangingIndent(text, indent, label = "", labelColor = (s) => s, width = process.stdout.columns || 80) {
		const pad = "  ".repeat(indent);
		const prefix = "- ";
		const labelStr = label ? label + ": " : "";
		const prefixPad = pad + prefix + labelStr;
		const hangingPad = pad + " ".repeat(prefix.length + labelStr.length);
		const maxWidth = width - (pad.length + prefix.length + labelStr.length);
		const words = text.split(/\s+/);
		let lines = [];
		let line = "";
		for (const word of words) {
			if ((line + word).length > maxWidth) {
				lines.push(line.trim());
				line = word + " ";
			} else {
				line += word + " ";
			}
		}
		if (line.trim()) lines.push(line.trim());
		return lines.map((l, i) => (i === 0 ? pad + prefix + labelColor(labelStr) + l : hangingPad + l));
	}

	/**
	 * Recursively print commands and their subcommands indented under their parent.
	 * @param {Array} commands - List of commands to print
	 * @param {number} indent - Indentation level
	 * @param {Array} output - The output array to push lines to
	 * @param {Function} color - Color function
	 * @param {object} helper - Commander helper
	 */
	static printCommands(commands, indent = 1, output, color, helper) {
		for (const c of commands) {
			let term = c.name();
			if (c.options && c.options.some((opt) => opt.long !== "--help")) {
				term += " [options]";
			}
			if (c._args && c._args.length) {
				term +=
					" " +
					c._args
						.map((a) => {
							let name = a.name();
							if (a.variadic) name += "...";
							const argStr = a.required ? `<${name}>` : `[${name}]`;
							const colorFn = a.required ? chalk.magenta : chalk.yellow;
							return color(colorFn, argStr);
						})
						.join(" ");
			}
			let aliases = [];
			if (Array.isArray(c._aliases)) {
				aliases = c._aliases.filter((a) => a !== c.name());
			} else if (typeof c._aliases === "string") {
				if (c._aliases !== c.name()) aliases = [c._aliases];
			}
			let desc = (helper.commandDescription ? helper.commandDescription(c) : c.description()) || "";

			const pad = "  ".repeat(indent);
			// Use different color for subcommands
			const cmdColor = indent === 1 ? chalk.cyan : chalk.blueBright;
			output.push(`${pad}${color(cmdColor, term)}`);
			if (aliases.length) {
				CustomHelp.wrapTextWithHangingIndent(
					aliases.join(", "),
					indent + 1,
					"Aliases",
					(s) => color(chalk.yellow.italic, s),
					process.stdout.columns || 80
				).forEach((l) => output.push(l));
			}
			if (desc) {
				CustomHelp.wrapTextWithHangingIndent(
					desc,
					indent + 1,
					"Description",
					(s) => color(chalk.gray.italic, s),
					process.stdout.columns || 80
				).forEach((l) => output.push(l));
			}
			output.push("");

			// Print subcommands, if any
			if (c.commands && c.commands.length) {
				CustomHelp.printCommands(helper.visibleCommands(c), indent + 1, output, color, helper);
			}
		}
	}
}

/**
 * Dynamically imports all .mjs files in the lib directory (except commands.mjs) and registers their commands with the provided program.
 * @param {import('commander').Command} program - The Commander.js program instance to register commands on.
 */
export async function gatherCommands(program) {
	const __dirname = path.dirname(path.normalize(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\//, ""))));
	const libDir = path.resolve(__dirname, "..");
	const files = fs.readdirSync(libDir).filter((f) => f.endsWith(".mjs") && f !== "commands.mjs");
	for (const file of files) {
		const modPath = path.join(libDir, file);
		const modUrl = pathToFileURL(modPath).href;
		try {
			const mod = await import(modUrl);
			const api = mod && mod.default;
			if (api && typeof api.commands === "function") {
				api.commands(program);
			}
		} catch (e) {
			console.error("Failed to import", modUrl, e);
		}
	}

	// Set CustomHelp and showHelpAfterError for all subcommands recursively
	function setCustomHelpRecursive(cmd) {
		cmd.createHelp = () => new CustomHelp();
		if (typeof cmd.showHelpAfterError === "function") {
			cmd.showHelpAfterError(true);
		}
		if (cmd.commands && cmd.commands.length) {
			for (const sub of cmd.commands) {
				setCustomHelpRecursive(sub);
			}
		}
	}
	setCustomHelpRecursive(program);

	// Global help for 'cpm help <command>'
	program
		.command("help [cmd...]")
		.description("Show help for a command")
		.action((cmds) => {
			if (cmds && cmds.length) {
				let sub = program;
				for (const c of cmds) {
					sub = sub.commands.find((cmd) => cmd.name() === c) || sub;
				}
				sub.help();
			} else {
				program.help();
			}
		});
}

export { CustomHelp };
export default CustomHelp;
