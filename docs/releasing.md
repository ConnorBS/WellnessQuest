# Releasing

WellnessQuest uses **semver Git tags** to cut releases. The `deploy.yml` workflow watches for `vX.Y.Z` tag pushes and publishes the corresponding Docker image tags so self-hosters can pin to a stable channel.

## Image tag scheme

Published to `ghcr.io/connorbs/wellnessquest`:

| Source | Tags published | Who pins this |
|---|---|---|
| Git tag `vX.Y.Z` | `:vX.Y.Z`, `:X.Y.Z`, `:X.Y`, `:X`, `:stable`, `:latest`, `:sha-<7>` | Self-hosters (recommended) |
| Git tag `vX.Y.Z-pre.N` | `:vX.Y.Z-pre.N`, `:X.Y.Z-pre.N`, `:sha-<7>` | RC / beta testers |
| Branch `main` | `:edge`, `:sha-<7>` | Bleeding-edge testers |
| Branch `claude/**` | `:preview`, `:sha-<7>` | Development only |

A prerelease tag (anything with a `-pre.N`, `-rc.N`, `-beta.N` suffix) gets only the version-specific tags — it does **not** move the floating `:stable` / `:latest` / `:X.Y` / `:X` aliases. That's how a beta can exist on GHCR without yanking the current stable release out from under self-hosters.

## Cutting a release

1. **Make sure `main` is in the state you want released.** Merge the feature branches you intend to ship; run `pnpm typecheck`, `pnpm build`, `ruff check .`, `mypy app`, `pytest -q` locally so you're not finding problems in the release build.
2. **Tag from `main`**, never from a feature branch:
   ```bash
   git checkout main
   git pull --ff-only
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```
3. **Watch the deploy workflow** under Actions. On a green run the published tags are listed in the workflow summary. You'll also get an `alembic-upgrade-sql` artifact rendering the SQL the image will apply on first boot, so existing self-hosters can preview the schema diff.
4. **Write release notes** as a GitHub Release attached to the tag, calling out:
   - migrations applied
   - breaking config / env-var changes
   - notable new features
5. **(Optional) flag a prerelease** before a major version. Use `git tag -a v0.2.0-pre.1` for that — it builds and publishes `:v0.2.0-pre.1` but leaves `:stable` untouched. Promote to `v0.2.0` once you're confident.

## Choosing a version bump

Standard semver, since the user-facing surface is a self-hosted app:

- **Patch** — bug fixes, internal refactors, doc-only changes. Self-hosters can pin `:0.1` and get patches automatically.
- **Minor** — new features, additive schema changes (Alembic upgrades are reversible or no-op for existing data).
- **Major** — backward-incompatible config / env-var changes, destructive migrations, breaking API changes. Requires release-notes guidance for upgrade.

## Hotfix flow

For an urgent fix against an already-released line:

```bash
git checkout -b hotfix/v0.1.1 v0.1.0
# ... commits ...
git tag -a v0.1.1 -m "v0.1.1"
git push origin hotfix/v0.1.1 v0.1.1
```

The tag publishes the image; merge `hotfix/v0.1.1` back into `main` afterwards so the fix doesn't get lost.

## Yanking a bad release

You can't unpublish a tag's image, but you can move the floating aliases back:

1. Manually run the workflow on the previous good tag: Actions → deploy → `Run workflow` → pick the older tag's ref.
2. That rebuilds and re-pushes `:stable` / `:latest` / `:X.Y` / `:X` pointing at the older image.
3. Mark the bad release as "yanked" in its GitHub Release notes so the version-pinned tag stays installable but is clearly flagged.
