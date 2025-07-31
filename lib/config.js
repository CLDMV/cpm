import { loadConfig } from "../cpm.mjs";
import mainMenu from "../cpm.mjs";

export default async function configUI() {
	const config = await loadConfig();
	await mainMenu(config);
}
