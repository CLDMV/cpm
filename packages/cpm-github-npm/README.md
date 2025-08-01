# cpm-github-npm

GitHub npm registry provider module for the cpm CLI. This package provides a standardized settings menu and process command for GitHub npm registry integration.

## Registry Endpoints

This provider is for GitHub's npm registry (https://npm.pkg.github.com).
GitHub also supports other package ecosystems with different registry endpoints:

- Maven: https://maven.pkg.github.com
- RubyGems: https://rubygems.pkg.github.com
- NuGet: https://nuget.pkg.github.com
- Docker: https://docker.pkg.github.com (deprecated)
- Container: https://ghcr.io (GitHub Container Registry)

If you need support for other ecosystems, create a separate provider module.

## Usage

```js
import provider from "cpm-github-npm";
```

- `provider.menu(settings)`
- `provider.registryUrl()`
- `provider.install(opts)`
- `provider.publish(opts)`
- `provider.unpublish(opts)`
- `provider.uninstall(opts)`
- `provider.version(opts)`
- `provider.update(opts)`
- `provider.init(opts)`
