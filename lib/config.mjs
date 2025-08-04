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
			const loadedConfig = await configUtil.load();
			console.log(JSON.stringify(loadedConfig, null, 2));
			process.exit(0);
		}
		let loadedConfig = config;
		if (!loadedConfig) {
			loadedConfig = await configUtil.load();
		}
		let running = true;
		while (running) {
			let section;
			section = await select({
				message: "cpm Main Menu",
				choices: [
					{ name: `${ConfigAPI.icon.choice({ type: "menu" })} Passcode`, value: "passcode" },
					{ name: `${ConfigAPI.icon.choice({ type: "menu" })} Global Settings`, value: "global" },
					{ name: `${ConfigAPI.icon.choice({ type: "menu" })} Namespaces`, value: "namespaces" },
					{ name: `${ConfigAPI.icon.choice({ type: "menu" })} Providers`, value: "providers" },
					{ name: `${ConfigAPI.icon.choice({ type: "exit" })} Exit`, value: "exit" }
				],
				pageSize: 10
			});
			if (section === undefined || section === "exit") {
				running = false;
				break;
			}
			if (section === "passcode") {
				await this.menu.passcode(loadedConfig);
			} else if (section === "global") {
				// console.log(loadedConfig);
				// Only show provider settings if there are providers; otherwise, return to main menu
				if (Array.isArray(loadedConfig.providers) && loadedConfig.providers.length > 0) {
					await this.menu.provider(loadedConfig, "global", "Global Settings");
				} else {
					// If no providers, do nothing (just return to main menu)
				}
			} else if (section === "namespaces") {
				await this.menu.namespaces(loadedConfig);
			} else if (section === "providers") {
				await this.menu.providers(loadedConfig);
			}
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
		 * Providers management menu (lists all providers and allows per-provider config).
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.providers(config);
		 */
		async providers(config) {
			// Find prebuilt providers from packages/cpm-* folders
			const providersDir = path.resolve("./packages");
			let prebuiltProviders = [];
			try {
				prebuiltProviders = fs
					.readdirSync(providersDir)
					.filter((f) => {
						// Only include folders that start with cpm- and are directories
						if (!f.startsWith("cpm-")) return false;
						const fullPath = path.join(providersDir, f);
						if (!fs.statSync(fullPath).isDirectory()) return false;
						// Only include if package.json exists in the folder
						const pkgJson = path.join(fullPath, "package.json");
						if (!fs.existsSync(pkgJson)) return false;
						return true;
					})
					.map((f) => f.replace(/^cpm-/, ""));
			} catch (e) {
				// ignore if packages dir missing
			}
			let back = false;
			while (!back) {
				// Always refresh installed providers after any change
				const installed = await configUtil.getProviders(config);
				// Only show prebuilt providers that are not already present in config.providers
				const configProviderNames = Array.isArray(config.providers) ? config.providers : [];
				// Remove @builtin/cpm- prefix for comparison
				const installedPrebuilt = configProviderNames
					.filter((p) => p.startsWith("@builtin/cpm-"))
					.map((p) => p.replace(/^@builtin\/cpm-/, ""));
				let availablePrebuilt = prebuiltProviders.filter((prov) => !installedPrebuilt.includes(prov));
				let choices = [];
				if (installed && installed.length > 0) {
					choices.push(
						...installed.map(({ name }) => ({
							name: `${ConfigAPI.icon.choice({ type: "menu" })} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
							value: name
						}))
					);
				}
				choices.push(
					...availablePrebuilt.map((prov) => ({
						name: `${ConfigAPI.icon("+", "green")} Add Prebuilt: ${prov}`,
						value: `prebuilt:${prov}`
					}))
				);
				choices.push({ name: `${ConfigAPI.icon("+", "green")} Add Custom Provider`, value: "add-custom" });
				if (Array.isArray(config.providers) && config.providers.length > 0) {
					choices.push({ name: `${ConfigAPI.icon("-", "red")} Remove Provider`, value: "remove-provider" });
				}
				choices.push({ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" });
				const provider = await select({
					message: "Providers Menu - Select Provider",
					choices,
					pageSize: 10
				});
				if (provider === undefined || provider === "back") {
					back = true;
					continue;
				}
				if (provider === "remove-provider") {
					await this.removeProvider(config);
					continue;
				}
				if (provider.startsWith && provider.startsWith("prebuilt:")) {
					const provName = provider.replace("prebuilt:", "");
					// Use the actual folder name as the package name (e.g., cpm-github → @builtin/cpm-github)
					const newProvider = `@builtin/cpm-${provName}`;
					if (!config.providers) config.providers = [];
					if (config.providers.includes(newProvider)) {
						console.log(chalk.yellow(`[!] Provider '${newProvider}' already present in config.`));
						continue;
					}
					// No npm install for prebuilt providers—just add to config
					config.providers.push(newProvider);
					if (!config.global.providers) config.global.providers = {};
					if (!config.global.providers[newProvider]) config.global.providers[newProvider] = {};
					for (const ns of Object.keys(config.namespaces)) {
						if (!config.namespaces[ns].providers) config.namespaces[ns].providers = {};
						if (!config.namespaces[ns].providers[newProvider]) config.namespaces[ns].providers[newProvider] = {};
					}
					ConfigAPI.cleanup(config);
					configUtil.save(config);
					console.log(chalk.green(`[+] Prebuilt provider '${newProvider}' added to config.`));
					continue;
				} else if (provider === "add-custom") {
					const newProvider = await input({
						message: "Enter full provider package name (must start with 'cpm-' or '@namespace/cpm-'). Leave blank to go back:"
					});
					if (!newProvider) continue;
					// Validate: must start with 'cpm-' or '@namespace/cpm-'
					const valid = /^cpm-[\w-]+$|^@[^/]+\/cpm-[\w-]+$/.test(newProvider);
					if (!valid) {
						console.log(chalk.red("[!] Provider name must start with 'cpm-' or '@namespace/cpm-'."));
						continue;
					}
					if (!config.providers) config.providers = [];
					if (config.providers.includes(newProvider)) {
						console.log(chalk.yellow(`[!] Provider '${newProvider}' already present in config.`));
						continue;
					}
					console.log(chalk.cyan(`[~] Installing npm module '${newProvider}'...`));
					const ok = await npmUtil.install(newProvider);
					if (!ok) {
						console.log(chalk.red(`[!] Failed to install npm module '${newProvider}'. Please check the package name and try again.`));
						continue;
					}
					config.providers.push(newProvider);
					if (!config.global.providers) config.global.providers = {};
					if (!config.global.providers[newProvider]) config.global.providers[newProvider] = {};
					for (const ns of Object.keys(config.namespaces)) {
						if (!config.namespaces[ns].providers) config.namespaces[ns].providers = {};
						if (!config.namespaces[ns].providers[newProvider]) config.namespaces[ns].providers[newProvider] = {};
					}
					ConfigAPI.cleanup(config);
					configUtil.save(config);
					console.log(chalk.green(`[+] Custom provider '${newProvider}' added to config.`));
					continue;
				}
				// Reuse the provider settings menu for the selected provider
				await this.provider(config, provider, `Provider: ${provider}`);
			}
		},
		/**
		 * Passcode management menu.
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.passcode(config);
		 */
		async passcode(config) {
			while (true) {
				const hasPasscode = !!config.passcode;
				const choices = [];
				const passcodeIcon = ConfigAPI.icon.choice({ inputRequired: true, value: hasPasscode });
				if (hasPasscode) {
					choices.push({ name: `${passcodeIcon} Change Passcode`, value: "change" });
					choices.push({ name: `${passcodeIcon} Clear Passcode`, value: "clear" });
				} else {
					choices.push({ name: `${passcodeIcon} Set Passcode`, value: "set" });
				}
				choices.push({ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" });

				const action = await select({
					message: "Passcode Menu",
					choices,
					pageSize: 10
				});
				if (action === undefined || action === "back") return;

				if (action === "set") {
					const newPass = await password({ message: "Enter new passcode (leave blank to go back):", mask: "*" });
					if (newPass === undefined || newPass === "") continue;
					config.passcode = newPass;
					configUtil.save(config);
				} else if (action === "change") {
					const oldPass = await password({ message: "Enter current passcode (leave blank to go back):", mask: "*" });
					if (oldPass === undefined || oldPass === "") continue;
					if (oldPass !== config.passcode) {
						console.log(chalk.red("[!] Incorrect passcode"));
						continue;
					}
					const newPass = await password({ message: "Enter new passcode (leave blank to go back):", mask: "*" });
					if (newPass === undefined || newPass === "") continue;
					config.passcode = newPass;
					configUtil.save(config);
				} else if (action === "clear") {
					const oldPass = await password({ message: "Enter current passcode (leave blank to go back):", mask: "*" });
					if (oldPass === undefined || oldPass === "") continue;
					if (oldPass !== config.passcode) {
						console.log(chalk.red("[!] Incorrect passcode"));
						continue;
					}
					config.passcode = null;
					configUtil.save(config);
				}
			}
		},

		/**
		 * Provider settings menu (GitHub/NPM/custom providers).
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @param {string} scope - The config scope ("global" or namespace).
		 * @param {string} label - The label for the menu.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.provider(config, "global", "Global Settings");
		 */
		/**
		 * Provider settings menu (GitHub/NPM/custom providers).
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
			if (!settings.providers) settings.providers = {};
			// Debug: show which provider names are being requested for loading
			// if (Array.isArray(config.providers)) {
			// 	console.log("[debug] config.providers:", config.providers);
			// } else {
			// 	console.log("[debug] config.providers is not an array:", config.providers);
			// }
			// Show which folders are present in packages/
			// try {
			// 	const providersDir = path.resolve("./packages");
			// 	const folders = fs.readdirSync(providersDir).filter((f) => fs.statSync(path.join(providersDir, f)).isDirectory());
			// 	console.log("[debug] packages/ folders:", folders);
			// } catch (e) {
			// 	console.log("[debug] packages/ folder not found or unreadable");
			// }
			const installed = await configUtil.getProviders(config);
			// Debug output: show installed providers and their module keys
			// console.log(
			// 	"[debug] installed providers:",
			// 	installed.map((p) => p.name)
			// );
			if (installed.length === 0) {
				console.log(
					"[warn] No provider modules were loaded. Check that your providers array contains valid provider names and that the corresponding modules exist in node_modules or packages."
				);
			}
			// for (const p of installed) {
			// 	console.log(`[debug] provider '${p.name}' module keys:`, Object.keys(p.module));
			// }
			while (true) {
				const provider = await select({
					message: `${label} - Select Provider`,
					choices: [
						...installed.map(({ name }) => ({
							name: `${ConfigAPI.icon.choice({ type: "menu" })} ${name.charAt(0).toUpperCase() + name.slice(1)}`,
							value: name
						})),
						{ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" }
					],
					pageSize: 10
				});
				if (provider === undefined || provider === "back") break;
				const provObj = installed.find((p) => p.name === provider);
				if (!provObj) {
					console.log(chalk.red(`[!] Provider module for '${provider}' not loaded.`));
					continue;
				}
				// Ensure settings.providers[provider] exists
				if (!settings.providers[provider]) settings.providers[provider] = {};

				// Use provider.menu to build menu choices with icons
				const isNamespace = scope !== "global";
				/**
				 * Build menu choices for a provider's settings.
				 * @param {object} srcSettings - The settings object for the provider.
				 * @returns {Array} Array of menu choice objects.
				 */
				const getMenuChoices = async (provSettings) => {
					// Support both default and named exports for provider modules
					let menuFn = null;
					if (provObj.module.menu) {
						menuFn = provObj.module.menu;
					} else if (provObj.module.default && provObj.module.default.menu) {
						menuFn = provObj.module.default.menu;
					} else if (provObj.module.get && provObj.module.get.menu) {
						menuFn = provObj.module.get.menu;
					} else if (provObj.module.default && provObj.module.default.get && provObj.module.default.get.menu) {
						menuFn = provObj.module.default.get.menu;
					}
					if (typeof menuFn === "function") {
						const statusArr = menuFn(provSettings);
						const choices = statusArr.map((item) => {
							// For namespace/global, pass extra info for icon coloring and package default
							let iconStr;
							if (isNamespace && item.key !== "token" && provSettings[item.key] === "global") {
								iconStr = ConfigAPI.icon.choice({
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
								iconStr = ConfigAPI.icon.choice({
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
							if (isNamespace && item.key !== "token" && provSettings[item.key] === "global") {
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
						choices.push({ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" });
						return choices;
					}
					// fallback
					return [
						{
							name: `${ConfigAPI.icon.choice({ inputRequired: true, value: !!provSettings.token, isNamespace })} Token`,
							value: "token",
							isToken: true,
							type: "inputRequired"
						},
						{ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" }
					];
					// await this.removeProvider(config);
				};
				// Call customSettings for the selected provider
				await this.customSettings(
					settings.providers[provider],
					() => {
						ConfigAPI.cleanup(config);
						configUtil.save(config);
					},
					getMenuChoices,
					scope,
					provider,
					config,
					isNamespace
				);
			}
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
				const choices = await getMenuChoices(settings);
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
					{ name: `${ConfigAPI.icon("+", "green")} Add Namespace`, value: "add" },
					...Object.keys(config.namespaces).map((ns) => ({
						name: `${ConfigAPI.icon.choice({ value: true })} ${ns}`,
						value: ns
					})),
					{ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" }
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
					// Use all providers from config.providers (built-in and 3rd-party) via central loader
					const installed = await configUtil.getProviders(config);
					config.namespaces[ns] = { providers: {} };
					for (const srcObj of installed) {
						try {
							let keys = [];
							if (typeof srcObj.module.menu === "function") {
								const menu = srcObj.module.menu({});
								if (Array.isArray(menu)) {
									keys = menu.map((item) => item.key);
								}
							}
							config.namespaces[ns].providers[srcObj.name] = {};
							for (const key of keys) {
								config.namespaces[ns].providers[srcObj.name][key] = key === "token" ? null : "global";
							}
						} catch (e) {
							// If the provider can't be loaded, skip it
						}
					}
					// this.cleanup(config);
					ConfigAPI.cleanup(config);
					configUtil.save(config);
				} else {
					await this.provider(config, nsChoice, `Namespace ${nsChoice}`);
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
		 * Submenu for removing providers from config.
		 * @public
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 * @example
		 * await ConfigAPI.menu.removeProvider(config);
		 */

		/**
		 * Remove Provider menu: always lists all providers in config.providers, not just loaded ones.
		 * @param {Object} config - The loaded config object.
		 * @returns {Promise<void>}
		 */
		removeProvider: async function (config) {
			let done = false;
			while (!done) {
				const providerNames = Array.isArray(config.providers) ? config.providers : [];
				if (!providerNames.length) {
					// No warning, just return to Providers menu
					return;
				}
				const choices = [
					...providerNames.map((prov) => ({
						name: `${ConfigAPI.icon.choice({ value: true })} ${prov}`,
						value: prov
					})),
					{ name: `${ConfigAPI.icon.choice({ type: "back" })} Back`, value: "back" }
				];
				const action = await select({
					message: "Remove Provider",
					choices,
					pageSize: 10
				});
				if (action === undefined || action === "back") {
					done = true;
					continue;
				}
				const confirmRemove = await confirm({ message: `Remove provider '${action}' from config?`, default: false });
				if (confirmRemove) {
					config.providers = config.providers.filter((p) => p !== action);
					if (config.global && config.global.providers) delete config.global.providers[action];
					for (const ns of Object.keys(config.namespaces)) {
						if (config.namespaces[ns].providers) delete config.namespaces[ns].providers[action];
					}
					configUtil.save(config);
					console.log(chalk.green(`[x] Provider '${action}' removed from config.`));
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
				if (type === "menu") return ConfigAPI.icon(">", "cyan");
				if (type === "exit") return ConfigAPI.icon("X", "red");
				if (type === "back") return ConfigAPI.icon("<", "yellow");
				if (parent === false) {
					return value === false ? ConfigAPI.icon(" ", "gray") : ConfigAPI.icon("!", "red");
				}
				// Namespace: show 'g' for global, colored by the effective global value or package default
				if (isNamespace && value === "global") {
					let hasGlobal = false;
					let globalVal = undefined;
					// Look in config.global.providers for provider settings (not sources)
					if (
						config &&
						globalKey &&
						thisSettingKey &&
						config.global &&
						config.global.providers &&
						config.global.providers[globalKey] &&
						Object.prototype.hasOwnProperty.call(config.global.providers[globalKey], thisSettingKey)
					) {
						globalVal = config.global.providers[globalKey][thisSettingKey];
						hasGlobal = true;
					}
					// If not set, use package default
					if (!hasGlobal && typeof defaultValue !== "undefined") {
						globalVal = defaultValue;
					}
					let color = "yellow";
					if (globalVal === true) color = "green";
					else if (globalVal === false) color = "red";
					return ConfigAPI.icon("g", color);
				}
				if (inputRequired) {
					return value ? ConfigAPI.icon("x", "green") : ConfigAPI.icon("!", "red");
				}
				return value ? ConfigAPI.icon("x", "green") : ConfigAPI.icon(" ", "gray");
			}
		}
	),
	/**
	 * Cleans up the config object: removes empty/invalid entries from global, global.providers, namespaces, and providers.
	 * - Removes any entry in global.providers or namespaces[ns].providers that does not contain 'cpm-'.
	 * - Removes empty objects from global, global.providers, namespaces, namespaces[ns].providers.
	 * - Removes providers array entries that do not contain 'cpm-'.
	 * @param {object} config - The config object to clean up.
	 */
	cleanup(config) {
		// Clean global.providers
		if (config.global && config.global.providers) {
			for (const key of Object.keys(config.global.providers)) {
				if (!key.includes("cpm-")) {
					delete config.global.providers[key];
				} else if (Object.keys(config.global.providers[key]).length === 0) {
					delete config.global.providers[key];
				}
			}
			if (Object.keys(config.global.providers).length === 0) delete config.global.providers;
		}
		// Clean global
		for (const key of Object.keys(config.global)) {
			if (key !== "providers" && typeof config.global[key] === "object" && Object.keys(config.global[key]).length === 0) {
				delete config.global[key];
			}
		}
		// Clean namespaces
		if (config.namespaces) {
			for (const ns of Object.keys(config.namespaces)) {
				const nsObj = config.namespaces[ns];
				if (nsObj.providers) {
					for (const key of Object.keys(nsObj.providers)) {
						if (!key.includes("cpm-")) {
							delete nsObj.providers[key];
						} else if (Object.keys(nsObj.providers[key]).length === 0) {
							delete nsObj.providers[key];
						}
					}
					if (Object.keys(nsObj.providers).length === 0) delete nsObj.providers;
				}
				for (const key of Object.keys(nsObj)) {
					if (key !== "providers" && typeof nsObj[key] === "object" && Object.keys(nsObj[key]).length === 0) {
						delete nsObj[key];
					}
				}
			}
		}
		// Clean providers array
		if (Array.isArray(config.providers)) {
			config.providers = config.providers.filter((s) => s.includes("cpm-"));
		}
	}
};

export default ConfigAPI;
