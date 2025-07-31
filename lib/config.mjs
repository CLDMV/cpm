import configUtil from "./util/config.mjs";
import chalk from "chalk";
import { input, password, confirm, select } from "@inquirer/prompts";
import fs from "fs";
import path from "path";

/**
 * Centralized icon logic for menu choices.
 * @param {Object} opts
 * @param {boolean} [opts.inputRequired] - If true, icon is ! (not set) or green x (set).
 * @param {boolean} [opts.value] - The value to check (for booleans or input presence).
 * @param {boolean} [opts.parent] - If false, return icon is [!] if value is not false, else [ ].
 * @param {string} [opts.type] - The type of menu item ("menu", "exit", "back").
 * @returns {string} The icon string.
 * @example
 * makeChoiceIcon({ type: "menu" });
 */
function makeChoiceIcon({ inputRequired = false, value, parent = true, type } = {}) {
	if (type === "menu") return icon(">", "cyan");
	if (type === "exit") return icon("X", "red");
	if (type === "back") return icon("<", "yellow");
	if (parent === false) {
		return value === false ? icon(" ", "gray") : icon("!", "red");
	}
	if (inputRequired) {
		return value ? icon("x", "green") : icon("!", "red");
	}
	return value ? icon("x", "green") : icon(" ", "gray");
}

/**
 * Helper: pretty-print icons with colored inner symbol only.
 * @param {string} symbol - The symbol to display inside the icon.
 * @param {string} color - The chalk color to use for the symbol.
 * @returns {string} The formatted icon string.
 * @example
 * icon('x', 'red'); // '[x]' (red x)
 */
function icon(symbol, color) {
	const colorFn = typeof chalk[color] === "function" ? chalk[color] : (s) => s;
	const inner = symbol.trim() === "" ? " " : colorFn(symbol);
	return `[${inner}]`;
}

/**
 * Get the list of installed sources from config.
 * @param {Object} config - The loaded config object.
 * @returns {string[]} Array of installed source names.
 * @example
 * getInstalledSources(config);
 */
function getInstalledSources(config) {
	return Array.isArray(config.sources) ? config.sources : [];
}

/**
 * Entrypoint for the interactive config UI.
 * Loads config and shows the main menu.
 * @returns {Promise<void>}
 * @example
 * await configUI();
 */
export default async function configUI() {
	const config = await configUtil.load();
	await mainMenu(config);
}

/**
 * Main menu for the config UI.
 * @param {Object} config - The loaded config object.
 * @returns {Promise<void>}
 * @example
 * await mainMenu(config);
 */
async function mainMenu(config) {
	while (true) {
		const section = await select({
			message: "cpm Main Menu",
			choices: [
				{ name: `${makeChoiceIcon({ type: "menu" })} Passcode`, value: "passcode" },
				{ name: `${makeChoiceIcon({ type: "menu" })} Global Settings`, value: "global" },
				{ name: `${makeChoiceIcon({ type: "menu" })} Namespaces`, value: "namespaces" },
				{ name: `${makeChoiceIcon({ type: "menu" })} Sources`, value: "sources" },
				{ name: `${makeChoiceIcon({ type: "exit" })} Exit`, value: "exit" }
			],
			pageSize: 10
		});
		if (section === undefined) return;
		if (section === "passcode") {
			await passcodeMenu(config);
		} else if (section === "global") {
			await providerMenu(config, "global", "Global Settings");
		} else if (section === "namespaces") {
			await namespacesMenu(config);
		} else if (section === "sources") {
			await sourcesMenu(config);
		} else {
			process.exit(0);
		}
	}
}

/**
 * Passcode management menu.
 * @param {Object} config - The loaded config object.
 * @returns {Promise<void>}
 * @example
 * await passcodeMenu(config);
 */
async function passcodeMenu(config) {
	const hasPasscode = !!config.passcode;
	const choices = [];
	const passcodeIcon = makeChoiceIcon({ inputRequired: true, value: hasPasscode });
	if (hasPasscode) {
		choices.push({ name: `${passcodeIcon} Change Passcode`, value: "change" });
		choices.push({ name: `${passcodeIcon} Clear Passcode`, value: "clear" });
	} else {
		choices.push({ name: `${passcodeIcon} Set Passcode`, value: "set" });
	}
	choices.push({ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" });

	const action = await select({
		message: "Passcode Menu",
		choices,
		pageSize: 10
	});
	if (action === undefined || action === "back") return;

	if (action === "set") {
		const newPass = await password({ message: "Enter new passcode (leave blank to go back):" });
		if (newPass === undefined || newPass === "") return;
		config.passcode = newPass;
		configUtil.save(config);
	} else if (action === "change") {
		const oldPass = await password({ message: "Enter current passcode (leave blank to go back):" });
		if (oldPass === undefined || oldPass === "") return;
		if (oldPass !== config.passcode) {
			console.log(chalk.red("[!] Incorrect passcode"));
			return;
		}
		const newPass = await password({ message: "Enter new passcode (leave blank to go back):" });
		if (newPass === undefined || newPass === "") return;
		config.passcode = newPass;
		configUtil.save(config);
	} else if (action === "clear") {
		config.passcode = null;
		configUtil.save(config);
	}
}

/**
 * Provider settings menu (GitHub/NPM/custom sources).
 * @param {Object} config - The loaded config object.
 * @param {string} scope - The config scope ("global" or namespace).
 * @param {string} label - The label for the menu.
 * @returns {Promise<void>}
 * @example
 * await providerMenu(config, "global", "Global Settings");
 */
async function providerMenu(config, scope, label) {
	const settings = scope === "global" ? config.global : config.namespaces[scope];
	if (!settings.sources) settings.sources = {};
	const installedSources = getInstalledSources(config);
	const sources = {};
	for (const src of installedSources) {
		try {
			sources[src] = await import(`../packages/cpm-${src}/index.js`);
		} catch (e) {
			console.log(chalk.red(`[!] Could not load source: cpm-${src}`));
		}
	}
	while (true) {
		const provider = await select({
			message: `${label} - Select Provider`,
			choices: [
				...installedSources.map((src) => ({
					name: `${makeChoiceIcon({ type: "menu" })} ${src.charAt(0).toUpperCase() + src.slice(1)}`,
					value: src
				})),
				{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
			],
			pageSize: 10
		});
		if (provider === undefined || provider === "back") break;
		if (!sources[provider]) {
			console.log(chalk.red(`[!] Source module for '${provider}' not loaded.`));
			continue;
		}
		// Ensure settings.sources[provider] exists
		if (!settings.sources[provider]) settings.sources[provider] = {};

		// Use getMenuStatus to build menu choices with icons
		const getMenuChoices = (srcSettings) => {
			if (typeof sources[provider].getMenuStatus === "function") {
				const statusArr = sources[provider].getMenuStatus(srcSettings);
				const choices = statusArr.map((item) => {
					let label = `${makeChoiceIcon({ [item.iconType]: true, value: item.value, parent: item.parent })} ${item.label}`;
					if (item.help && item.parent === false) {
						label += ` ${chalk.yellow("(!)")}`;
						label += ` ${chalk.gray("- " + item.help)}`;
					}
					return {
						name: label,
						value: item.key,
						help: item.help
					};
				});
				choices.push({ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" });
				return choices;
			}
			// fallback
			return [
				{ name: `${makeChoiceIcon({ inputRequired: true, value: !!srcSettings.token })} Token`, value: "token" },
				{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
			];
		};
		// Delegate menu logic to the source module, passing getMenuChoices
		if (typeof sources[provider].getSettingsMenu === "function") {
			// Wrap getMenuChoices to show help if a blocked item is selected
			const wrappedMenuChoices = (srcSettings) => {
				const choices = getMenuChoices(srcSettings);
				// Patch select to show help if needed
				return choices.map((choice) => {
					if (choice.help && choice.parent === false) {
						// Add a warning to the label or as a tooltip (console log for now)
						choice.name += ` ${chalk.yellow("(!)")}`;
					}
					return choice;
				});
			};
			await sources[provider].getSettingsMenu(settings.sources[provider], () => configUtil.save(config), wrappedMenuChoices);
		} else {
			console.log(chalk.yellow(`[!] Source '${provider}' does not export getSettingsMenu(settings, saveCb, getMenuChoices)`));
		}
	}
}

/**
 * Namespace management menu.
 * @param {Object} config - The loaded config object.
 * @returns {Promise<void>}
 * @example
 * await namespacesMenu(config);
 */
async function namespacesMenu(config) {
	let back = false;
	while (!back) {
		const choices = [
			{ name: `${icon("+", "green")} Add Namespace`, value: "add" },
			...Object.keys(config.namespaces).map((ns) => ({
				name: `${makeChoiceIcon({ value: true })} ${ns}`,
				value: ns
			})),
			{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
		];
		const nsChoice = await select({
			message: "Namespaces",
			choices,
			pageSize: 10
		});
		if (nsChoice === undefined || nsChoice === "back") {
			back = true;
			continue;
		}
		if (nsChoice === "add") {
			const ns = await input({ message: "Enter new namespace (@scope) (leave blank to go back):" });
			if (ns === undefined || ns === "") continue;
			config.namespaces[ns] = {
				github: { token: null, publish: null, releases: null },
				npm: { token: null, publish: null, allowPrivate: null }
			};
			configUtil.save(config);
		} else {
			await providerMenu(config, nsChoice, `Namespace ${nsChoice}`);
		}
	}
}

/**
 * Sources management menu.
 * Offers prebuilt sources as selectable options, and allows full text input for custom sources (e.g., @cldmv/cpm-github).
 * @param {Object} config - The loaded config object.
 * @returns {Promise<void>}
 * @example
 * await sourcesMenu(config);
 */
async function sourcesMenu(config) {
	let back = false;
	// Find prebuilt sources from packages/cpm-* folders
	const sourcesDir = path.resolve("./packages");
	let prebuiltSources = [];
	try {
		prebuiltSources = fs
			.readdirSync(sourcesDir)
			.filter((f) => f.startsWith("cpm-") && fs.statSync(path.join(sourcesDir, f)).isDirectory())
			.map((f) => f.replace(/^cpm-/, ""));
	} catch (e) {
		// ignore if packages dir missing
	}
	while (!back) {
		const installed = getInstalledSources(config);
		const choices = [
			...prebuiltSources
				.filter((src) => !installed.includes(src))
				.map((src) => ({
					name: `${icon("+", "green")} Add Prebuilt: ${src}`,
					value: `prebuilt:${src}`
				})),
			{ name: `${icon("+", "green")} Add Custom Source`, value: "add-custom" },
			...(installed.length > 0 ? [{ name: `${icon("-", "red")} Remove Source`, value: "remove-source" }] : []),
			{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
		];
		const action = await select({
			message: "Sources Menu",
			choices,
			pageSize: 10
		});
		if (action === undefined || action === "back") {
			back = true;
			continue;
		}
		if (action.startsWith && action.startsWith("prebuilt:")) {
			const newSource = action.replace("prebuilt:", "");
			if (!config.sources) config.sources = [];
			if (!config.sources.includes(newSource)) {
				config.sources.push(newSource);
				if (!config.global[newSource]) config.global[newSource] = {};
				for (const ns of Object.keys(config.namespaces)) {
					if (!config.namespaces[ns][newSource]) config.namespaces[ns][newSource] = {};
				}
				configUtil.save(config);
				console.log(chalk.green(`[+] Prebuilt source '${newSource}' added to config.`));
			} else {
				console.log(chalk.yellow(`[!] Source '${newSource}' already present in config.`));
			}
		} else if (action === "add-custom") {
			const newSource = await input({
				message: "Enter full source package name (must start with 'cpm-' or '@namespace/cpm-'). Leave blank to go back:"
			});
			if (!newSource) continue;
			// Validate: must start with 'cpm-' or '@namespace/cpm-'
			const valid = /^cpm-[\w-]+$|^@[^/]+\/cpm-[\w-]+$/.test(newSource);
			if (!valid) {
				console.log(chalk.red("[!] Source name must start with 'cpm-' or '@namespace/cpm-'."));
				continue;
			}
			if (!config.sources) config.sources = [];
			if (!config.sources.includes(newSource)) {
				config.sources.push(newSource);
				if (!config.global[newSource]) config.global[newSource] = {};
				for (const ns of Object.keys(config.namespaces)) {
					if (!config.namespaces[ns][newSource]) config.namespaces[ns][newSource] = {};
				}
				configUtil.save(config);
				console.log(chalk.green(`[+] Source '${newSource}' added to config.`));
			} else {
				console.log(chalk.yellow(`[!] Source '${newSource}' already present in config.`));
			}
		} else if (action === "remove-source") {
			await removeSourceMenu(config);
		}
	}

	/**
	 * Submenu for removing sources from config.
	 * @param {Object} config - The loaded config object.
	 * @returns {Promise<void>}
	 */
	async function removeSourceMenu(config) {
		let done = false;
		while (!done) {
			const installed = getInstalledSources(config);
			if (!installed.length) {
				console.log(chalk.yellow("[!] No sources to remove."));
				return;
			}
			const choices = [
				...installed.map((src) => ({
					name: `${makeChoiceIcon({ value: true })} ${src}`,
					value: src
				})),
				{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
			];
			const action = await select({
				message: "Remove Source",
				choices,
				pageSize: 10
			});
			if (action === undefined || action === "back") {
				done = true;
				continue;
			}
			const confirmRemove = await confirm({ message: `Remove source '${action}' from config?`, default: false });
			if (confirmRemove) {
				config.sources = config.sources.filter((s) => s !== action);
				delete config.global[action];
				for (const ns of Object.keys(config.namespaces)) {
					delete config.namespaces[ns][action];
				}
				configUtil.save(config);
				console.log(chalk.green(`[x] Source '${action}' removed from config.`));
			}
		}
	}
}
