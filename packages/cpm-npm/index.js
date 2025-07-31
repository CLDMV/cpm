/**
 * NPM provider for cpm CLI.
 * @module cpm-npm
 */
import { password, select } from "@inquirer/prompts";
import chalk from "chalk";

/**
 * Returns an array of menu item descriptors for the config UI.
 * Each item: { key, label, iconType, value }
 * @param {object} settings - The NPM settings object.
 * @returns {Array} Menu item descriptors.
 */
export function getMenuStatus(settings) {
	const tokenSet = !!settings.token;

	return [
		{ key: "token", label: "Token", iconType: "inputRequired", value: tokenSet },
		{
			key: "publish",
			label: "Publish",
			iconType: "value",
			value: !!settings.publish,
			parent: tokenSet,
			help: !tokenSet && !!settings.publish ? "A token is required to enable publishing." : undefined
		},
		{
			key: "private",
			label: "Allow Private",
			iconType: "value",
			value: !!settings.allowPrivate,
			parent: tokenSet,
			help: !tokenSet && !!settings.allowPrivate ? "A token is required to allow private packages." : undefined
		}
	];
}

export async function getSettingsMenu(settings, saveConfig, getMenuChoices) {
	let back = false;
	while (!back) {
		const choices = getMenuChoices(settings);
		const action = await select({
			message: "NPM Settings",
			choices,
			pageSize: 10
		});
		if (action === undefined || action === "back") {
			back = true;
			continue;
		}
		// Find the selected choice object
		const selected = choices.find((c) => c.value === action);
		if (selected && selected.parent === false && selected.help) {
			// Show help text for blocked item
			console.log(chalk.yellow(`[!] ${selected.help}`));
			continue;
		}
		if (action === "token") {
			const token = await password({ message: "Enter token (leave blank to clear, just Enter to go back):" });
			if (token === undefined) continue;
			if (token === "") continue;
			settings.token = token;
			saveConfig();
		} else if (action === "publish") {
			settings.publish = !settings.publish;
			saveConfig();
		} else if (action === "private") {
			settings.allowPrivate = !settings.allowPrivate;
			saveConfig();
		}
	}
}

/**
 * Standardized process command for NPM source.
 * @param {object} settings - The NPM settings object.
 * @param {string[]} args - Arguments for the process command.
 * @returns {void}
 * @example
 * processSource(settings, ["arg1", "arg2"]);
 */
export function processSource(settings, args) {
	// Example: print settings and args
	console.log(chalk.cyan("[NPM] Processing command with settings:"), settings, args);
}
