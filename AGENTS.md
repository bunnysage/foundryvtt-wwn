# Repository Instructions

- Only open pull requests against the `bunnysage/foundryvtt-wwn` fork. Never open pull requests against `SobranDM/foundryvtt-wwn` or any upstream repository unless explicitly instructed by the user in that same request.

## Version awareness

- **1.6.1 is the canonical, working version of this fork.** It is what runs in the live game. Treat the `1.6.1` branch (and the `v1.6.1` tag) as the source of truth for shipping changes.
- **1.7.0 is incomplete and must not be treated as a release.** Even though it was pushed to `master`/main, that was sloppiness on the original author's part — `master` being at 1.7.0 does *not* mean 1.7.0 is finished or safe to deploy. Never install or ship 1.7.0 to the live game.
- When in doubt about which lineage to build against, target **1.6.1**. Only work on 1.7.0 when the user explicitly asks for it, and keep the two lineages separate.
