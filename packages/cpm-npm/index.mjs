const provider = {
	/**
	 * Returns menu item descriptors for the config UI.
	 * @param {object} settings - The NPM settings object.
	 * @returns {Array} Menu item descriptors.
	 * @example
	 * provider.menu({ token: 'abc', publish: true, allowPrivate: false });
	 */
	menu(settings) {
		const tokenSet = !!settings.token;
		return [
			{ key: "token", label: "Token", iconType: "inputRequired", value: tokenSet },
			{
				key: "publish",
				label: "Publish",
				iconType: "value",
				value: settings.publish,
				parent: tokenSet,
				type: "boolean",
				default: true,
				help: !tokenSet && !!settings.publish ? "A token is required to enable publishing." : undefined
			},
			{
				key: "allowPrivate",
				label: "Allow Private",
				iconType: "value",
				value: settings.allowPrivate,
				parent: tokenSet,
				type: "boolean",
				default: false,
				help: !tokenSet && !!settings.allowPrivate ? "A token is required to allow private packages." : undefined
			}
		];
	},
	command: {
		async install(opts) {},
		async publish(opts) {},
		async unpublish(opts) {},
		async uninstall(opts) {},
		async version(opts) {},
		async update(opts) {},
		async init(opts) {}
	},
	get: {
		registry() {
			return "https://registry.npmjs.org";
		},
		/**
		 * Returns the version of this provider from its package.json.
		 * @returns {string}
		 */
		async version() {
			try {
				const pkg = await import("./package.json", { assert: { type: "json" } });
				return pkg.default.version;
			} catch {
				return undefined;
			}
		},
		/**
		 * Stub for repo info (npm does not have repo privacy in the same way as GitHub).
		 * @param {string} pkg - The npm package name.
		 * @returns {Promise<{exists: boolean, pkg: string, data?: object, error?: string}>}
		 */
		repo: async function (pkg, opts = {}) {
			try {
				let token = (opts && opts.token) || (typeof opts === "object" && opts.settings && opts.settings.token);
				let res, data;
				if (token) {
					res = await fetch(`https://registry.npmjs.org/${pkg}`, {
						headers: { Authorization: `Bearer ${token}` }
					});
					data = await res.json().catch(() => undefined);
					if (res.ok && data && data.name) {
						return { exists: true, pkg, data };
					}
					// If token fails, fall through to public method
				}
				// Try public (no token)
				res = await fetch(`https://registry.npmjs.org/${pkg}`);
				data = await res.json().catch(() => undefined);
				if (res.ok && data && data.name) {
					return { exists: true, pkg, data };
				}
				return { exists: false, pkg, error: `Package not found.`, data };
			} catch (err) {
				return { exists: false, pkg, error: err && err.message ? err.message : String(err) };
			}
		}
	}
};

export default provider;
