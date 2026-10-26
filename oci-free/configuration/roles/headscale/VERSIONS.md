# headscale / headplane version tracking

Pinned versions live in `defaults/main.yml` (`headscale_version`, `headplane_version`).

## Last check: 2026-10-26

| Component | Pinned | Latest upstream | Released | Source |
|---|---|---|---|---|
| headscale | 0.29.6 | v0.29.6 | 2026-10-24 | https://github.com/juanfont/headscale/releases/tag/v0.29.6 |
| headplane | 0.8.2 | v0.8.2 | 2026-10-22 | https://github.com/tale/headplane/releases/tag/v0.8.2 |

Bumped from 0.29.4/0.7.1 on 2026-10-26. Notes checked before bumping:
- headscale 0.29.4 → 0.29.6: patch releases, no config schema changes.
- headplane 0.7.1 → 0.8.2: no config key changes; all keys used by `templates/headplane-config.yaml.j2` still valid. 0.8.0 adds a structured ACL editor (drops HuJSON comments when used), 0.8.1 fixes actions behind a TLS-terminating reverse proxy (our Caddy setup), 0.8.2 is a security update (Node.js 24.22.1 / Go 1.27.3, GHSA-jhh3-g853-mxjc) and fixes duplicate agent machine registration.

Previously bumped from 0.28.0/0.6.3 on 2026-09-25. Notes checked before bumping:
- headscale 0.28.0 → 0.29.4: no breaking config schema changes, only bugfixes/features (SSH check action, policy tests, tags-as-identity landed in 0.28.0 already).
- headplane 0.6.3 → 0.7.1: **0.7.0 consolidated some config options** (see https://github.com/tale/headplane/blob/main/config.example.yaml). Compared against this role's `templates/headplane-config.yaml.j2` — all keys in use (`server.host/port/base_url/cookie_secret/cookie_secure/data_path`, `headscale.url/config_path/api_key`, `integration.docker.enabled/container_label/socket`) are still valid in 0.7.1, so no template changes were needed. headplane 0.7.0+ requires headscale 0.27.0+ (satisfied).

No automated update mechanism exists — check manually against:

```
curl -s https://api.github.com/repos/juanfont/headscale/releases/latest | grep -E '"tag_name"|"published_at"'
curl -s https://api.github.com/repos/tale/headplane/releases/latest | grep -E '"tag_name"|"published_at"'
```

Before bumping, read the release changelog for breaking changes — headscale minor/major bumps often change the config schema (`config.yaml.j2` template in this role), and headplane's `config.yaml.j2` may need matching adjustments.
