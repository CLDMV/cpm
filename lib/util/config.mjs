/**
 * cpm config API utility (ESM default export).
 */
import fs from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";

const CONFIG_PATH = path.join(os.homedir(), ".cpm-config.json");

const config = {
	/**
	 * Load configuration, auto-create if missing or broken.
	 * @returns {Promise<Object>} The loaded or newly created config object.
	 */
	async load() {
		if (!fs.existsSync(CONFIG_PATH)) {
			const fresh = {
				passcode: null,
				global: {
					github: { token: null, publish: true, releases: true },
					npm: { token: null, publish: true, allowPrivate: false }
				},
				namespaces: {}
			};
			fs.writeFileSync(CONFIG_PATH, JSON.stringify(fresh, null, "\t"));
			return fresh;
		}
		try {
			const raw = fs.readFileSync(CONFIG_PATH, "utf8");
			return JSON.parse(raw);
		} catch (e) {
			console.error(chalk.red("[!] Config parse error."));
			const reset = await confirm({
				message: "Config invalid. Reset and backup?",
				default: false
			});
			if (reset) {
				fs.renameSync(CONFIG_PATH, CONFIG_PATH + ".bak");
				return config.load();
			} else {
				process.exit(1);
			}
		}
	},

	/**
	 * Save configuration immediately.
	 * @param {Object} cfg - The config object to save.
	 */
	save(cfg) {
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, "\t"));
	},

	/**
	 * Get a single value from the config by key path (dot notation).
	 * @param {string} key - Dot notation key (e.g. 'global.github.token').
	 * @returns {Promise<any>} The value at the given key, or undefined if not found.
	 */
	async get(key) {
		const cfg = await config.load();
		if (!key) return cfg;
		const parts = key.split(".");
		let obj = cfg;
		for (const part of parts) {
			if (obj && typeof obj === "object" && part in obj) {
				obj = obj[part];
			} else {
				return undefined;
			}
		}
		return obj;
	},

	/**
	 * Set a single value in the config by key path (dot notation) and save immediately.
	 * @param {string} key - Dot notation key (e.g. 'global.github.token').
	 * @param {any} value - The value to set.
	 * @returns {Promise<void>}
	 */
	async set(key, value) {
		const cfg = await config.load();
		if (!key) return;
		const parts = key.split(".");
		let obj = cfg;
		for (let i = 0; i < parts.length - 1; i++) {
			if (!(parts[i] in obj) || typeof obj[parts[i]] !== "object") {
				obj[parts[i]] = {};
			}
			obj = obj[parts[i]];
		}
		obj[parts[parts.length - 1]] = value;
		config.save(cfg);
	}
};

export default config;
