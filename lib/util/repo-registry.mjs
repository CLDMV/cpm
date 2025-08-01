/**
 * Central registry for repo providers (class-like singleton).
 * Allows packages to register repo info functions for cross-package queries.
 */
/**
 * Central registry for repo providers (object-based singleton).
 * Allows packages to register repo info functions for cross-package queries.
 */
const repoRegistry = {
	providers: {},
	/**
	 * Register a repo provider.
	 * @param {string} name - The provider name (e.g., 'github', 'npm').
	 * @param {function} infoFn - Function to return repo info.
	 */
	register(name, infoFn) {
		this.providers[name] = infoFn;
	},
	/**
	 * Get repo info for a provider.
	 * @param {string} name - The provider name.
	 * @param {...any} args - Arguments to pass to the info function.
	 * @returns {object|null} Repo info or null if not registered.
	 */
	async info(name, ...args) {
		if (this.providers[name]) return this.providers[name](...args);
		return null;
	}
};

export default repoRegistry;
