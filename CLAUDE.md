# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo does

Infrastructure-as-code that provisions a free-tier Oracle Cloud Infrastructure (OCI) ARM VM (4 CPU, 24GB RAM, Ubuntu 22.04, 100GB disk, backups, public IP) using Pulumi (TypeScript), then configures it with Ansible (Docker, NTP, swap, unattended-upgrades removal, No-IP dynamic DNS client). Everything runs from inside a single Docker container defined in this repo — there is no host-side Node/Python toolchain to install.

## Commands

All actual work happens inside the `oci` docker-compose service; there's no way to run Pulumi/Ansible directly from the host.

- `make oci` — builds the tooling image (`docker-compose build`) and drops you into an interactive shell inside the container (`docker-compose run --rm oci`). This is the primary entrypoint for all work in this repo.
- `make code` — opens VS Code on the repo (`code .`).
- `make help` — lists Makefile targets (uses the `##target: @ description` comment convention — follow it if adding targets).

Inside the container (after `make oci`), the entrypoint (`docker/scripts/oci.entrypoint.sh`) automatically:
1. Copies SSH keys from the mounted `~/.ssh` into `/root/.ssh`.
2. Installs Ansible Galaxy role dependencies (`ansible-galaxy install -r requirements.yml`).
3. Runs `npm install` in `oci-free/infrastructure`.
4. Initializes/selects the Pulumi stack `oci-free` and sets `oci:userOcid`, `oci:fingerprint`, `oci:tenancyOcid`, `oci:privateKeyPath`, `oci:region` config from env vars.
5. Drops you into a shell at `/code/oci-free`.

From that shell, typical operations are plain Pulumi/Ansible commands:
- `cd infrastructure && pulumi up` / `pulumi destroy` / `pulumi preview` — provision or tear down the OCI stack.
- `cd configuration && bash ansible-init.sh` — runs `ansible-playbook playbook.yml -i inventory.ini --private-key ${INSTANCE_PRIVATE_KEY_NAME}` against the provisioned instance (note: `ansible.cfg` points `inventory` at `inventory.cfg`, but the init script passes `-i inventory.ini` — reconcile filenames if inventory resolution breaks).

There is no test suite, linter, or build step beyond `npm install`/TypeScript compilation implicit in `pulumi up`.

## Configuration

Config is env-var driven via a `.env` file (copy `template.env` → `.env`, never commit `.env`). Key variables: `USER_OCID`, `FINGERPRINT`, `TENANCY_OCID`, OCI/instance SSH key filenames (`PRIVATE_KEY_NAME`, `PUBLIC_KEY_NAME`, `INSTANCE_PRIVATE_KEY_NAME`, `INSTANCE_PUBLIC_KEY_NAME` — resolved as paths under `~/.ssh` mounted into the container), `REGION`, `PULUMI_ACCESS_TOKEN`, and `NOIP_HOSTNAMES`/`NOIP_USERNAME`/`NOIP_PASSWORD` for the No-IP DDNS role. Secrets/keys stay on the host (`~/.ssh`, `~/.oci`, `~/.pulumi` are bind-mounted into the container) rather than being baked into the repo.

## Architecture

Two independent-but-sequenced layers, both under `oci-free/`:

**`infrastructure/`** — single-file Pulumi program (`index.ts`) using the `@pulumi/oci` provider. Order of resource creation matters conceptually even though Pulumi resolves the dependency graph itself: compartment → VCN → internet gateway → default route table → default security list (opens 22/80/443 ingress, all egress) → subnet → network security group (ICMP rule) → OCI image lookup (filtered to ARM `aarch64` Canonical Ubuntu 22.04 images via a display-name regex) → compute instance (public IP disabled at the VNIC, assigned separately) → private/public IP association → volume backup policy + assignment. Shape/OS/sizing constants live at the top of `index.ts` (`VM_SHAPE`, `VM_RAM_SIZE`, `VM_CPUS_NUM`, `VM_BOOT_DISK_SIZE`, `VM_OS_NAME`, `VM_OS_VERSION`) — change these to resize the free-tier VM. All resource names are prefixed with `DEFAULT_TAG` ("oci-free").

**`configuration/`** — Ansible playbook (`playbook.yml`) targeting host group `ociserver` (populate its IP in `inventory.template.ini` → `inventory.ini`, post-provisioning). Runs four role sets in order:
1. `ubuntu-bootstrap` — removes snapd and unattended-upgrades, installs build-essential, then delegates to third-party Galaxy roles (`robertdebock.update`, `geerlingguy.ntp`, `geerlingguy.pip`, `geerlingguy.swap`, `robertdebock.reboot`) pinned by version in `requirements.yml`.
2. `docker` — delegates to `geerlingguy.docker`, adds `ubuntu` to the `docker` group, reboots.
3. `noip` — downloads, builds (via `cargo`), and daemonizes the No-IP DUC client for dynamic DNS, using `NOIP_USERNAME`/`NOIP_PASSWORD`/`NOIP_HOSTNAMES` env vars passed straight into the ansible command line.
4. `headscale` — deploys a Docker Compose stack under `/opt/headscale` (Headscale VPN server, Headplane web UI, Caddy reverse proxy) served at the No-IP hostname. Image versions are pinned in `defaults/main.yml`; `VERSIONS.md` records the last upstream check and changelog notes — read release notes before bumping. On first run it creates a Headscale API key for Headplane (`/opt/headscale/headplane/api_key`, copied to `~ubuntu/headplane_api_key`). The key expires after `headplane_apikey_expiration` (default `90d`) and the role does **not** renew it while the file exists — rotate it on the server with `~ubuntu/rotate-headplane-key.sh [expiration]` (installed from `templates/rotate-headplane-key.sh.j2`), which creates a new key, updates both key files and Headplane's `config.yaml`, and restarts Headplane.

Role-local tunables (swap size, NTP timezone, reboot delays, docker package state) live in each role's `defaults/main.yml` — prefer overriding there over hardcoding in `tasks/main.yml`.

The Pulumi and Ansible layers only connect via the instance's public IP: Pulumi provisions it, and it must be manually copied into `inventory.ini` before running the playbook (no automation currently wires this handoff together).
