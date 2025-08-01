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
			.description("Install things")
			.helpOption("-h, --help", "Show install help")
			// .examples(["$ cpm install <node_module>", "$ cpm install provider <node_module>"])
			.examples(["$ cpm install <node_module>"])
			.argument("<subcommand|node_module>", "The subcommand (e.g. provider) or node module to install")
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
					// install <node_module>
					InstallUninstallAPI.run("install", "package", { package: subject });
				} else {
					// plain 'install'
					InstallUninstallAPI.run("install", "package", {});
				}
			});

		install
			.command("provider")
			.aliases(["-p", "--provider"])
			// .usage("<node_module>")
			.description("Install a provider and add it to the config")
			// .description(
			// 	"Install a provider and add it to the config. Install a provider and add it to the config. .Install a provider and add it to the config Install a provider and add it to the config."
			// )
			.helpOption("-h, --help", "Show provider help")
			.examples(["$ cpm install provider <node_module>"])
			.argument("<node_module>", "Provider node module to install")
			.action(function (provider, ...args) {
				const command = args[args.length - 1];
				if (provider === "help" || command.args[0] === "help") {
					command.help();
				}
				InstallUninstallAPI.run("install", "provider", { provider });
			});

		return [install];
	}
};

export default InstallUninstallAPI;
