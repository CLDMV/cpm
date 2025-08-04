/**
 * InstallUninstallAPI: API object for install/uninstall CLI features.
 * @namespace InstallUninstallAPI
 */
const InstallUninstallAPI = {
	/**
	 * Main entry for install/uninstall logic.
	 * @param {string} action - The action to perform (e.g. 'install', 'uninstall').
	 * @param {string} subject - The subject type (e.g. 'provider').
	 * @param {object} argv - The CLI arguments.
	 * @returns {Promise<void>}
	 * @example
	 * await InstallUninstallAPI.run('install', 'provider', { provider: 'foo' });
	 */
	async run(action, subject, argv) {
		if (action === "install") {
			if (subject === "provider") {
				const { default: installProvider } = await import("./commands/install-uninstall/provider.mjs");
				await installProvider(argv);
				return;
			} else if (subject === "package") {
				const { default: installPackage } = await import("./commands/install-uninstall/package.mjs");
				await installPackage(argv);
				return;
			}
		}
		// Add more dispatch logic for other actions/subjects as needed
		throw new Error(`Unknown install/uninstall command: ${action} ${subject}`);
	},

	/**
	 * Returns Commander.js command objects for install/uninstall.
	 * @param {import('commander').Command} program - The Commander program instance.
	 * @returns {Array<import('commander').Command>} Array of command objects.
	 * @example
	 * const cmds = InstallUninstallAPI.commands(program);
	 * cmds.forEach(cmd => program.addCommand(cmd));
	 */
	commands(program) {
		const install = program
			.command("install")
			.aliases(["-i", "--install"])
			.usage("<subcommand|node_module>")
			.description(
				"Install a package or provider module. Use 'install <module>' to install a package, or 'install provider <module>' to install a provider and add it to the config."
			)
			.examples(["$ cpm install <module>"])
			.argument("<subcommand|node_module>", "The subcommand (e.g. provider) or module to install")
			.argument("[node_module]", "Provider name if subcommand is 'provider'")
			.action(function (subject, name, ...args) {
				const command = args[args.length - 1];
				// If 'help' is the subject or no args and first arg is 'help'
				if (subject === "help" || (Array.isArray(command.args) && command.args[0] === "help")) {
					command.help();
				} else if (subject === "provider") {
					// install provider <name>
					if (name === "help") {
						command.help();
					} else if (name) {
						InstallUninstallAPI.run("install", "provider", { provider: name });
					} else {
						// No provider name given
						command.help();
					}
				} else if (subject) {
					// install <module>
					InstallUninstallAPI.run("install", "package", { package: subject });
				} else {
					// plain 'install'
					InstallUninstallAPI.run("install", "package", {});
				}
			});

		install
			.command("provider")
			.aliases(["-p", "--provider"])
			// .usage("<module>")
			.description("Install a provider module and add it to the configuration. This allows CPM to use the provider for future operations.")
			// .description(
			//  "Install a provider and add it to the config. Install a provider and add it to the config. .Install a provider and add it to the config Install a provider and add it to the config."
			// )
			.examples(["$ cpm install provider <module>"])
			.argument("<module>", "Provider module to install")
			.action(function (provider, ...args) {
				const command = args[args.length - 1];
				if (provider === "help" || command.args[0] === "help") {
					command.help();
				}
				InstallUninstallAPI.run("install", "provider", { provider });
			});

		// Uninstall command
		const uninstall = program
			.command("uninstall")
			.aliases(["-u", "--uninstall"])
			.usage("<subcommand|module>")
			.description(
				"Uninstall a package or provider module. Use 'uninstall <module>' to remove a package, or 'uninstall provider <module>' to remove a provider and update the config."
			)
			.examples(["$ cpm uninstall <module>"])
			.argument("<subcommand|module>", "The subcommand (e.g. provider) or module to uninstall")
			.argument("[module]", "Provider name if subcommand is 'provider'")
			.action(function (subject, name, ...args) {
				const command = args[args.length - 1];
				if (subject === "help" || (Array.isArray(command.args) && command.args[0] === "help")) {
					command.help();
				} else if (subject === "provider") {
					if (name === "help") {
						command.help();
					} else if (name) {
						InstallUninstallAPI.run("uninstall", "provider", { provider: name });
					} else {
						command.help();
					}
				} else if (subject) {
					InstallUninstallAPI.run("uninstall", "package", { package: subject });
				} else {
					InstallUninstallAPI.run("uninstall", "package", {});
				}
			});

		uninstall
			.command("provider")
			.aliases(["-p", "--provider"])
			.description("Uninstall a provider module and remove it from the configuration. This disables the provider for future operations.")
			.examples(["$ cpm uninstall provider <module>"])
			.argument("<module>", "Provider module to uninstall")
			.action(function (provider, ...args) {
				const command = args[args.length - 1];
				if (provider === "help" || command.args[0] === "help") {
					command.help();
				}
				InstallUninstallAPI.run("uninstall", "provider", { provider });
			});

		return [install, uninstall];
	}
};

export default InstallUninstallAPI;
