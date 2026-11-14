# SwarmKit website

Product site, developer docs, and agent guide for the [SwarmKit SDK](https://github.com/mikemoulder/swarmkit).

Run `node build.mjs` to regenerate the documentation from its source and the runnable quickstart. Open the repository with a static HTTP server. The site uses relative paths and can be deployed at a domain root or under a GitHub Pages project path.

The guides live in `guides.mjs`; the build emits ten documentation pages, a search index and `llms-full.txt`. TypeScript declarations are checked into `sdk-reference/`, so a standalone checkout can rebuild without the core repository. The landing-page playground executes the compiled SDK from `assets/sdk/`.

When the SDK changes, build it in the core repository, then run `node build.mjs --sdk ../../dist/sdk` from this checkout to refresh declarations, playground modules and runnable examples. Run `node verify.mjs` to check local page links, machine-readable quickstart content and generated API coverage. Open the site with a static HTTP server to check its interactive playground and documentation search.

The landing page uses the [Taste Skill](https://github.com/Leonxlnx/taste-skill) system and pinned-chapters motion. Third-party license terms are in [assets/LICENSE](assets/LICENSE).
