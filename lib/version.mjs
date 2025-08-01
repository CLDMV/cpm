import config from "./util/config.mjs";
/**
 * VersionAPI: API object for version CLI features.
 * @namespace VersionAPI
 */
const VersionAPI = {
	/**
	 * Main entry for version logic.
	 * @returns {Promise<void>}
	 * @example
	 * await VersionAPI.run();
	 */
	async run() {
		// Find global node_modules path once for reuse
		let globalNodeModules = null;
		const fs = await import("fs");
		const path = await import("path");
		const { execSync } = await import("child_process");
		try {
			const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
			globalNodeModules = npmRoot;
		} catch (e) {}

		const pkgPath = path.default.resolve("./package.json");
		const pkg = JSON.parse(fs.default.readFileSync(pkgPath, "utf8"));

		// Build the versions object in the correct order: cpm, sources, npm, node, then dependencies
		const versions = {};
		versions["cpm"] = pkg.version;

		// Add all sources/packages in ./packages as @builtin/<name>, but do not show if @namespace/<name> is installed
		// Also scan node_modules (local/global) for installed sources in config

		// Use config util to load config
		const configObj = await config.load();

		// Get all sources from config (installed sources)
		const installedSources = await config.getSources(configObj);
		for (const src of installedSources) {
			let version = "not installed";
			try {
				// Try to get version from the module's package.json
				if (src.module && src.module.version) {
					version = src.module.version;
				} else if (src.module && src.module.default && src.module.default.version) {
					version = src.module.default.version;
				} else if (src.module.get && src.module.get.version) {
					version = typeof src.module.get.version === "function" ? await src.module.get.version() : src.module.get.version;
				} else if (src.name.startsWith("@builtin/")) {
					// Builtin: look in ./packages
					const localName = src.name.replace(/^@builtin\//, "");
					const pkgPath = path.default.join(path.default.resolve("./packages"), localName, "package.json");
					const pkgJson = JSON.parse(fs.default.readFileSync(pkgPath, "utf8"));
					version = pkgJson.version;
				} else {
					// 3rd party: look in node_modules (local/global)
					const nodeModulesPaths = [path.default.resolve("./node_modules"), globalNodeModules].filter(Boolean);
					let found = false;
					for (const nmPath of nodeModulesPaths) {
						try {
							const depPkgPath = path.default.join(nmPath, src.name, "package.json");
							const depPkg = JSON.parse(fs.default.readFileSync(depPkgPath, "utf8"));
							version = depPkg.version;
							found = true;
							break;
						} catch (e) {}
					}
					if (!found) version = "not installed";
				}
			} catch (e) {}
			versions[src.name] = version;
		}

		// Add npm version only (not its scanned modules)
		let npmVer = "not found";
		try {
			npmVer = execSync("npm --version", { encoding: "utf8" }).trim();
		} catch (e) {}
		versions["npm"] = npmVer;

		// Add node version
		versions["node"] = process.version.replace(/^v/, "");

		// List dependencies and their versions (add if not already present), searching both local and global node_modules
		const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
		const nodeModulesPaths = [path.default.resolve("./node_modules"), globalNodeModules].filter(Boolean);
		for (const dep of Object.keys(deps)) {
			if (!(dep in versions)) {
				let found = false;
				for (const nmPath of nodeModulesPaths) {
					try {
						const depPkgPath = path.default.join(nmPath, dep, "package.json");
						const depPkg = JSON.parse(fs.default.readFileSync(depPkgPath, "utf8"));
						versions[dep] = depPkg.version;
						found = true;
						break;
					} catch (e) {}
				}
				if (!found) {
					versions[dep] = "not installed";
				}
			}
		}

		console.log(versions);
	},

	/**
	 * Returns Commander.js command objects for version.
	 * Adds aliases -V and --version for convenience.
	 * @param {import('commander').Command} program - The Commander program instance.
	 * @returns {Array<import('commander').Command>} Array of command objects.
	 * @example
	 * const cmds = VersionAPI.commands(program);
	 * cmds.forEach(cmd => program.addCommand(cmd));
	 */
	commands(program) {
		const versionCmd = program
			.command("version")
			.aliases(["-V", "--version"])
			.description("Show version info for cpm, node, npm, and dependencies")
			.action(() => {
				VersionAPI.run();
			});
		return [versionCmd];
	}
};

export default VersionAPI;
