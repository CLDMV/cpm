import configUtil from "./util/config.mjs";
import npmUtil from "./util/npm.mjs";
import chalk from "chalk";
import { input, password, confirm, select } from "@inquirer/prompts";
import fs from "fs";
import path from "path";

/**
 * ConfigAPI: Standardized API object for config-related CLI features.
 * Methods will be added incrementally as part of the refactor.
 * @namespace ConfigAPI
 */
const ConfigAPI = {
	/**
	 * Main menu for the config UI.
	 * @param {Object} config - The loaded config object.
	 * @returns {Promise<void>}
	 * @example
	 * await mainMenu(config);
	 */
	async run(config) {
		// --- CLI: --dumpconfig support ---
		if (process.argv.includes("--dumpconfig")) {
			(async () => {
				const config = await configUtil.load();
				console.log(JSON.stringify(config, null, 2));
				process.exit(0);
			})();
		}
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
				await this.menu.passcode(config);
			} else if (section === "global") {
				await this.menu.provider(config, "global", "Global Settings");
			} else if (section === "namespaces") {
				await this.menu.namespaces(config);
			} else if (section === "sources") {
				await this.menu.sources(config);
			}
			//  else {
			//  process.exit(0);
			// }
		}
	},

	/**
	 * Adds Commander.js command objects for CPM CLI.
	 * @param {import('commander').Command} program - The Commander program instance.
	 * @returns {Array<import('commander').Command>} Array of command objects.
	 * @example
	 * import configapi from './lib/configapi.mjs';
	 * const commands = configapi.commands(program);
	 * commands.forEach(cmd => program.addCommand(cmd));
	 */
	commands(program) {
		const configCmd = program
			.command("config")
			.aliases(["-c", "--config"])
			.usage(" ")
			.description("Open interactive config UI")
			.helpOption("-h, --help, help", "Show config help")
			.examples(["$ cpm config"])
			.allowExcessArguments()
			.action(function (...args) {
				const command = args[args.length - 1];
				if (command.args[0] === "help") {
					command.help();
				}
				ConfigAPI.run();
			});

		// Add more commands here as needed
		return [configCmd];
	},
	menu: {
		/**
		 * Passcode management menu.
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.passcode(config);
		 */
		async passcode(config) {
			const hasPasscode = !!config.passcode;
			const choices = [];
			const passcodeIcon = this.icon.choice({ inputRequired: true, value: hasPasscode });
			if (hasPasscode) {
				choices.push({ name: `${passcodeIcon} Change Passcode`, value: "change" });
				choices.push({ name: `${passcodeIcon} Clear Passcode`, value: "clear" });
			} else {
				choices.push({ name: `${passcodeIcon} Set Passcode`, value: "set" });
			}
			choices.push({ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" });

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
		},

		/**
		 * Provider settings menu (GitHub/NPM/custom sources).
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @param {string} scope - The config scope ("global" or namespace).
		 * @param {string} label - The label for the menu.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.provider(config, "global", "Global Settings");
		 */
		async provider(config, scope, label) {
			const settings = scope === "global" ? config.global : config.namespaces[scope];
			if (!settings.sources) settings.sources = {};
			const installed = await configUtil.getSources(config);
			while (true) {
				const provider = await select({
					message: `${label} - Select Provider`,
					choices: [
						...installed.map(({ name }) => ({
							name: `${makeChoiceIcon({ type: "menu" })} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
							value: name
						})),
						{ name: `${makeChoiceIcon({ type: "back" })} Back`, value: "back" }
					],
					pageSize: 10
				});
				if (provider === undefined || provider === "back") break;
				const srcObj = installed.find((s) => s.name === provider);
				if (!srcObj) {
					console.log(chalk.red(`[!] Source module for '${provider}' not loaded.`));
					continue;
				}
				// Ensure settings.sources[provider] exists
				if (!settings.sources[provider]) settings.sources[provider] = {};

				// Use provider.menu to build menu choices with icons
				const isNamespace = scope !== "global";
				/**
				 * Build menu choices for a provider's settings.
				 * @param {object} srcSettings - The settings object for the provider.
				 * @returns {Array} Array of menu choice objects.
				 */
				const getMenuChoices = (srcSettings) => {
					// Use new provider structure
					const menuFn = srcObj.module.menu || (srcObj.module.get && srcObj.module.get.menu);
					if (typeof menuFn === "function") {
						const statusArr = menuFn(srcSettings);
						const choices = statusArr.map((item) => {
							// For namespace/global, pass extra info for icon coloring and package default
							let iconStr;
							if (isNamespace && item.key !== "token" && srcSettings[item.key] === "global") {
								iconStr = this.icon.choice({
									[item.iconType]: true,
									value: "global",
									parent: item.parent,
									isNamespace,
									globalKey: provider,
									config,
									thisSettingKey: item.key,
									defaultValue: item.default
								});
							} else {
								iconStr = this.icon.choice({
									[item.iconType]: true,
									value: item.value,
									parent: item.parent,
									isNamespace,
									defaultValue: item.default
								});
							}
							let label = `${iconStr} ${item.label}`;
							if (item.help && item.parent === false) {
								label += ` ${chalk.yellow("(!)")}`;
								label += ` ${chalk.gray("- " + item.help)}`;
							}
							// Show (global) only for namespace settings
							if (isNamespace && item.key !== "token" && srcSettings[item.key] === "global") {
								label += chalk.gray(" (global)");
							}
							return {
								name: label,
								value: item.key,
								help: item.help,
								isToken: item.key === "token",
								type: item.type,
								callback: item.callback
							};
						});
						choices.push({ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" });
						return choices;
					}
					// fallback
					return [
						{
							name: `${this.icon.choice({ inputRequired: true, value: !!srcSettings.token, isNamespace })} Token`,
							value: "token",
							isToken: true,
							type: "inputRequired"
						},
						{ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" }
					];
				};
			} // Use menu.customSettingsMenu as a method
			await this.customSettings(
				settings.sources[provider],
				() => {
					this.cleanup(config);
					ConfigAPI.cleanup(config);
					configUtil.save(config);
				},
				getMenuChoices,
				scope,
				provider,
				config,
				isNamespace
			);
		},
		/**
		 * Custom settings menu to allow cycling true/false/global for non-token fields, and handle per-setting callbacks.
		 * @public
		 * @param {object} settings - The provider's settings object.
		 * @param {function} saveConfig - Function to save config.
		 * @param {function} getMenuChoices - Function to get menu choices.
		 * @param {string} scope - The config scope ("global" or namespace).
		 * @param {string} provider - The provider name.
		 * @param {object} config - The full config object.
		 * @param {boolean} isNamespace - True if in namespace scope.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.customSettings(settings, saveConfig, getMenuChoices, scope, provider, config, isNamespace);
		 */
		customSettings: async function (settings, saveConfig, getMenuChoices, scope, provider, config, isNamespace) {
			let back = false;
			// Build breadcrumb path for menu header
			const scopeLabel = scope === "global" ? "Global Settings" : `Namespace ${scope}`;
			const menuHeader = `${scopeLabel} > ${provider} Settings`;
			while (!back) {
				const choices = getMenuChoices(settings);
				const action = await select({
					message: menuHeader,
					choices,
					pageSize: 10
				});
				if (action === undefined || action === "back") {
					back = true;
					continue;
				}
				const selected = choices.find((c) => c.value === action);
				if (selected && selected.isToken) {
					// Token field: prompt for value
					const token = await password({ message: "Enter token (leave blank to clear, just Enter to go back):" });
					if (token === undefined) continue;
					if (token === "") {
						settings.token = null;
						saveConfig();
						continue;
					}
					settings.token = token;
					saveConfig();
				} else if (selected && selected.type === "boolean") {
					// Boolean field: cycle true/false/global for namespace, true/false for global
					const cur = settings[action];
					let next;
					if (isNamespace) {
						if (cur === true) next = false;
						else if (cur === false) next = "global";
						else next = true;
					} else {
						next = cur === true ? false : true;
					}
					// If callback is present, call it with the new value
					if (selected.callback) {
						try {
							const cbResult = await selected.callback(next, settings, config, scope);
							if (cbResult === true) {
								settings[action] = next;
								saveConfig();
							} else if (typeof cbResult === "string") {
								console.log(chalk.red(`[!] ${cbResult}`));
							} else {
								console.log(chalk.red("[!] Change rejected by provider."));
							}
						} catch (e) {
							console.log(chalk.red(`[!] Error in callback: ${e && e.message ? e.message : e}`));
						}
					} else {
						settings[action] = next;
						saveConfig();
					}
				} else {
					// Fallback: treat as boolean if not token
					const cur = settings[action];
					let next;
					if (isNamespace) {
						if (cur === true) next = false;
						else if (cur === false) next = "global";
						else next = true;
					} else {
						next = cur === true ? false : true;
					}
					settings[action] = next;
					saveConfig();
				}
			}
		},

		/**
		 * Namespace management menu.
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.namespaces(config);
		 */

		async namespaces(config) {
			let back = false;
			while (!back) {
				const choices = [
					{ name: `${this.icon("+", "green")} Add Namespace`, value: "add" },
					...Object.keys(config.namespaces).map((ns) => ({
						name: `${this.icon.choice({ value: true })} ${ns}`,
						value: ns
					})),
					{ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" }
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
					// Use all sources from config.sources (built-in and 3rd-party) via central loader
					const installed = await configUtil.getSources(config);
					config.namespaces[ns] = { sources: {} };
					for (const srcObj of installed) {
						try {
							let keys = [];
							if (typeof srcObj.module.menu === "function") {
								const menu = srcObj.module.menu({});
								if (Array.isArray(menu)) {
									keys = menu.map((item) => item.key);
								}
							}
							config.namespaces[ns].sources[srcObj.name] = {};
							for (const key of keys) {
								config.namespaces[ns].sources[srcObj.name][key] = key === "token" ? null : "global";
							}
						} catch (e) {
							// If the source can't be loaded, skip it
						}
					}
					// this.cleanup(config);
					ConfigAPI.cleanup(config);
					configUtil.save(config);
				} else {
					await providerMenu(config, nsChoice, `Namespace ${nsChoice}`);
				}
			}
		},

		/**
		 * Sources management menu.
		 * Offers prebuilt sources as selectable options, and allows full text input for custom sources (e.g., @cldmv/cpm-github).
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.sources(config);
		 */

		async sources(config) {
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
				const installed = await configUtil.getSources(config);
				const choices = [
					...prebuiltSources
						.filter((src) => !installed.some(({ name }) => name === `@builtin/cpm-${src}`))
						.map((src) => ({
							name: `${this.icon("+", "green")} Add Prebuilt: ${src}`,
							value: `prebuilt:${src}`
						})),
					{ name: `${this.icon("+", "green")} Add Custom Source`, value: "add-custom" },
					...(installed.length > 0 ? [{ name: `${this.icon("-", "red")} Remove Source`, value: "remove-source" }] : []),
					{ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" }
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
					const srcName = action.replace("prebuilt:", "");
					const newSource = `@builtin/cpm-${srcName}`;
					if (!config.sources) config.sources = [];
					if (config.sources.includes(newSource)) {
						console.log(chalk.yellow(`[!] Source '${newSource}' already present in config.`));
						return;
					}
					console.log(chalk.cyan(`[~] Installing npm module '${newSource}'...`));
					const ok = await npmUtil.install(newSource);
					if (!ok) {
						console.log(chalk.red(`[!] Failed to install npm module '${newSource}'. Please check the package name and try again.`));
						return;
					}
					config.sources.push(newSource);
					if (!config.global.sources) config.global.sources = {};
					if (!config.global.sources[newSource]) config.global.sources[newSource] = {};
					for (const ns of Object.keys(config.namespaces)) {
						if (!config.namespaces[ns].sources) config.namespaces[ns].sources = {};
						if (!config.namespaces[ns].sources[newSource]) config.namespaces[ns].sources[newSource] = {};
					}
					this.cleanup(config);
					configUtil.save(config);
					console.log(chalk.green(`[+] Prebuilt source '${newSource}' added to config.`));
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
					if (config.sources.includes(newSource)) {
						console.log(chalk.yellow(`[!] Source '${newSource}' already present in config.`));
						return;
					}
					console.log(chalk.cyan(`[~] Installing npm module '${newSource}'...`));
					const ok = await npmUtil.install(newSource);
					if (!ok) {
						console.log(chalk.red(`[!] Failed to install npm module '${newSource}'. Please check the package name and try again.`));
						return;
					}
					config.sources.push(newSource);
					if (!config.global.sources) config.global.sources = {};
					if (!config.global.sources[newSource]) config.global.sources[newSource] = {};
					for (const ns of Object.keys(config.namespaces)) {
						if (!config.namespaces[ns].sources) config.namespaces[ns].sources = {};
						if (!config.namespaces[ns].sources[newSource]) config.namespaces[ns].sources[newSource] = {};
					}
					this.cleanup(config);
					configUtil.save(config);
					console.log(chalk.green(`[+] Source '${newSource}' added to config.`));
				} else if (action === "remove-source") {
					await removeSourceMenu(config);
					this.cleanup(config);
					configUtil.save(config);
				}
			}
		},

		/**
		 * Submenu for removing sources from config.
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.removeSource(config);
		 */

		async removeSource(config) {
			let done = false;
			while (!done) {
				const installed = await configUtil.getSources(config);
				if (!installed.length) {
					console.log(chalk.yellow("[!] No sources to remove."));
					return;
				}
				const choices = [
					...installed.map((src) => ({
						name: `${this.icon.choice({ value: true })} ${src.name}`,
						value: src.name
					})),
					{ name: `${this.icon.choice({ type: "back" })} Back`, value: "back" }
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
	},
	/**
	 * Helper: pretty-print icons with colored inner symbol only.
	 * @param {string} symbol - The symbol to display inside the icon.
	 * @param {string} color - The chalk color to use for the symbol.
	 * @returns {string} The formatted icon string.
	 * @example
	 * ConfigAPI.icon('x', 'red'); // '[x]' (red x)
	 */
	icon: Object.assign(
		function (symbol, color) {
			const colorFn = typeof chalk[color] === "function" ? chalk[color] : (s) => s;
			const inner = symbol.trim() === "" ? " " : colorFn(symbol);
			return `[${inner}]`;
		},
		{
			/**
			 * Centralized icon logic for menu choices, with namespace/global awareness and package default support.
			 * @param {Object} opts
			 * @param {boolean} [opts.inputRequired] - If true, icon is ! (not set) or green x (set).
			 * @param {boolean|string} [opts.value] - The value to check (for booleans or input presence, or 'global').
			 * @param {boolean} [opts.parent] - If false, return icon is [!] if value is not false, else [ ].
			 * @param {string} [opts.type] - The type of menu item ("menu", "exit", "back").
			 * @param {boolean} [opts.isNamespace] - If true, treat as namespace (allow 'global' icon).
			 * @param {string} [opts.globalKey] - The provider key (for looking up global value if needed).
			 * @param {object} [opts.config] - The full config object (for looking up global value if needed).
			 * @param {string} [opts.thisSettingKey] - The key for the specific setting.
			 * @param {boolean} [opts.defaultValue] - The package default value for this setting.
			 * @returns {string} The icon string.
			 * @example
			 * ConfigAPI.icon.choice({ type: 'menu' })
			 */
			choice({
				inputRequired = false,
				value,
				parent = true,
				type,
				isNamespace = false,
				globalKey,
				config,
				thisSettingKey,
				defaultValue
			} = {}) {
				if (type === "menu") return this.icon(">", "cyan");
				if (type === "exit") return this.icon("X", "red");
				if (type === "back") return this.icon("<", "yellow");
				if (parent === false) {
					return value === false ? this.icon(" ", "gray") : this.icon("!", "red");
				}
				// Namespace: show 'g' for global, colored by the effective global value or package default
				if (isNamespace && value === "global") {
					let hasGlobal = false;
					let globalVal = undefined;
					// Always look in config.global.sources for provider settings
					if (
						config &&
						globalKey &&
						thisSettingKey &&
						config.global &&
						config.global.sources &&
						config.global.sources[globalKey] &&
						Object.prototype.hasOwnProperty.call(config.global.sources[globalKey], thisSettingKey)
					) {
						globalVal = config.global.sources[globalKey][thisSettingKey];
						hasGlobal = true;
					}
					// If not set, use package default
					if (!hasGlobal && typeof defaultValue !== "undefined") {
						globalVal = defaultValue;
					}
					let color = "yellow";
					if (globalVal === true) color = "green";
					else if (globalVal === false) color = "red";
					return this.icon("g", color);
				}
				if (inputRequired) {
					return value ? this.icon("x", "green") : this.icon("!", "red");
				}
				return value ? this.icon("x", "green") : this.icon(" ", "gray");
			}
		}
	),
	/**
	 * Cleans up the config object: removes empty/invalid entries from global, global.sources, namespaces, and sources.
	 * - Removes any entry in global.sources or namespaces[ns].sources that does not contain 'cpm-'.
	 * - Removes empty objects from global, global.sources, namespaces, namespaces[ns].sources.
	 * - Removes sources array entries that do not contain 'cpm-'.
	 * @param {object} config - The config object to clean up.
	 */
	cleanup(config) {
		// Clean global.sources
		if (config.global && config.global.sources) {
			for (const key of Object.keys(config.global.sources)) {
				if (!key.includes("cpm-")) {
					delete config.global.sources[key];
				} else if (Object.keys(config.global.sources[key]).length === 0) {
					delete config.global.sources[key];
				}
			}
			if (Object.keys(config.global.sources).length === 0) delete config.global.sources;
		}
		// Clean global
		for (const key of Object.keys(config.global)) {
			if (key !== "sources" && typeof config.global[key] === "object" && Object.keys(config.global[key]).length === 0) {
				delete config.global[key];
			}
		}
		// Clean namespaces
		if (config.namespaces) {
			for (const ns of Object.keys(config.namespaces)) {
				const nsObj = config.namespaces[ns];
				if (nsObj.sources) {
					for (const key of Object.keys(nsObj.sources)) {
						if (!key.includes("cpm-")) {
							delete nsObj.sources[key];
						} else if (Object.keys(nsObj.sources[key]).length === 0) {
							delete nsObj.sources[key];
						}
					}
					if (Object.keys(nsObj.sources).length === 0) delete nsObj.sources;
				}
				for (const key of Object.keys(nsObj)) {
					if (key !== "sources" && typeof nsObj[key] === "object" && Object.keys(nsObj[key]).length === 0) {
						delete nsObj[key];
					}
				}
			}
		}
		// Clean sources array
		if (Array.isArray(config.sources)) {
			config.sources = config.sources.filter((s) => s.includes("cpm-"));
		}
	}
};

export default ConfigAPI;
