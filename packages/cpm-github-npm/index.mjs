/**
 * NOTE: This provider is for GitHub's npm registry (https://npm.pkg.github.com).
 * GitHub also supports other package ecosystems with different registry endpoints:
 *   - Maven: https://maven.pkg.github.com
 *   - RubyGems: https://rubygems.pkg.github.com
 *   - NuGet: https://nuget.pkg.github.com
 *   - Docker: https://docker.pkg.github.com (deprecated)
 *   - Container: https://ghcr.io (GitHub Container Registry)
 * If you need support for other ecosystems, create a separate provider module.
 */
import repoRegistry from "../../lib/util/repo-registry.mjs";

const provider = {
	/**
	 * Returns menu item descriptors for the config UI.
	 * @param {object} settings - The GitHub settings object.
	 * @returns {Array} Menu item descriptors.
	 * @example
	 * provider.menu({ token: 'abc', publish: true, releases: false })
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
				help: !tokenSet && settings.publish ? "A token is required to enable publishing." : undefined
			},
			{
				key: "releases",
				label: "Releases",
				iconType: "value",
				value: settings.releases,
				parent: tokenSet,
				type: "boolean",
				default: false,
				help: !tokenSet && settings.releases ? "A token is required to enable releases." : undefined
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
			return "https://npm.pkg.github.com";
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
		 * Checks if a GitHub repo is public or private using the GitHub API.
		 * Returns the full API response as 'data'.
		 * @param {string} repo - Format: owner/repo
		 * @param {object} [opts] - Optional options, may include token or settings.token
		 * @returns {Promise<{isPublic: boolean|undefined, repo: string, error?: string, data?: object}>}
		 */
		repo: async function (repo, opts = {}) {
			try {
				if (!repo || typeof repo !== "string" || !repo.includes("/")) {
					return { isPublic: false, repo, error: "Invalid repo format. Use 'owner/repo'." };
				}
				// Strip leading @ from owner if present
				let [owner, ...rest] = repo.split("/");
				if (owner.startsWith("@")) owner = owner.slice(1);
				const repoPath = [owner, ...rest].join("/");

				// Try with token if present
				let token = (opts && opts.token) || (typeof opts === "object" && opts.settings && opts.settings.token);
				let res, data;
				if (token) {
					res = await fetch(`https://api.github.com/repos/${repoPath}`, {
						headers: { Authorization: `Bearer ${token}` }
					});
					data = await res.json().catch(() => undefined);
					if (res.ok && data) {
						return { isPublic: data && typeof data.private === "boolean" ? !data.private : undefined, repo, data };
					}
					// If token fails, fall through to public method
				}
				// Try public (no token)
				res = await fetch(`https://api.github.com/repos/${repoPath}`);
				data = await res.json().catch(() => undefined);
				if (!res.ok) {
					if (res.status === 404) {
						return { isPublic: false, repo, error: "Repository not found or is not public.", data };
					}
					return { isPublic: false, repo, error: `GitHub API error: ${res.status}`, data };
				}
				return { isPublic: data && typeof data.private === "boolean" ? !data.private : undefined, repo, data };
			} catch (err) {
				return { isPublic: false, repo, error: err && err.message ? err.message : String(err) };
			}
		}
	}
};

// Register as a repo provider
repoRegistry.register("github-npm", provider.get.repo);

export default provider;
