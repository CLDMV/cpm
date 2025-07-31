/**
 * GitHub provider for cpm CLI.
 * @module cpm-github
 */
import { password, select } from "@inquirer/prompts";
import chalk from "chalk";

/**
 * Returns a status object for the config UI to build menu choices.
 * @param {object} settings - The GitHub settings object.
 * @returns {object} Status for menu rendering.
 */
/**
 * Returns an array of menu item descriptors for the config UI.
 * Each item: { key, label, iconType, value }
 * @param {object} settings - The GitHub settings object.
 * @returns {Array} Menu item descriptors.
 */
export function getMenuStatus(settings) {
	const tokenSet = !!settings.token;
	// removed duplicate return [
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
			key: "releases",
			label: "Releases",
			iconType: "value",
			value: !!settings.releases,
			parent: tokenSet,
			help: !tokenSet && !!settings.releases ? "A token is required to enable releases." : undefined
		}
	];
}
export async function getSettingsMenu(settings, saveConfig, getMenuChoices) {
	let back = false;
	while (!back) {
		const choices = getMenuChoices(settings);
		const action = await select({
			message: "GitHub Settings",
			choices,
			pageSize: 10
		});
		if (action === undefined || action === "back") back = true;
		else if (action === "token") {
			const token = await password({ message: "Enter token (leave blank to clear, just Enter to go back):" });
			if (token === undefined) continue;
			if (token === "") continue;
			settings.token = token;
			saveConfig();
		} else if (action === "publish") {
			settings.publish = !settings.publish;
			saveConfig();
		} else if (action === "releases") {
			settings.releases = !settings.releases;
			saveConfig();
		}
	}
}

/**
 * Standardized process command for GitHub source.
 * @param {object} settings - The GitHub settings object.
 * @param {string[]} args - Arguments for the process command.
 * @returns {void}
 * @example
 * processSource(settings, ["arg1", "arg2"]);
 */
export function processSource(settings, args) {
	// Example: print settings and args
	console.log(chalk.cyan("[GitHub] Processing command with settings:"), settings, args);
}
