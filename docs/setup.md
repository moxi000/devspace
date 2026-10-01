# Setup Guide

This guide covers ChatGPT and Coding Agents using DevSpace with local projects.

## Requirements

- Node `>=22.19 <27`
- npm
- Git
- Bash, including Git Bash or WSL on Windows
- for ChatGPT: the official OpenAI `tunnel-client` and a tunnel/runtime key, or
  a public HTTPS URL forwarding to the local DevSpace server

The OpenAI option needs no separately configured tunneling service. For public
HTTPS, use Cloudflare Tunnel, ngrok, Pinggy, Tailscale Funnel, or your own reverse
proxy.

## Install And Configure

Run:

```bash
npx @waishnav/devspace init
```

The setup flow asks one question at a time.

First choose where you will use DevSpace: ChatGPT, Coding Agents, or both.
DevSpace uses that answer to skip setup that does not apply to you.
This selects where you invoke DevSpace from. It does not control which agents
DevSpace may run for delegated work.

### Project roots

If you selected ChatGPT, choose the project folders it may open through
DevSpace. Keep this narrow.

Examples:

```text
~/personal,~/work
```

```text
/Users/alice/dev,/Users/alice/work
```

```text
C:\Users\alice\dev,C:\Users\alice\work
```

A Coding Agents-only setup skips this question. Direct `devspace agents`
commands use the current Git project, or the current directory outside a
repository, with the authority of your local shell. MCP workspace operations
remain limited to the roots configured for ChatGPT.

### Subagents

Setup detects supported agents and asks which ones DevSpace may use as
subagents. ChatGPT or another coding agent can delegate work through DevSpace
to the agents selected here.
These choices are stored as provider objects under `subagents` in
`~/.devspace/config.jsonc`.

### Coding Agents

If you selected Coding Agents, setup prints:

```bash
npx skills add Waishnav/devspace --skill subagents --global
```

The Skills CLI asks which installed Coding Agents should receive the skill.
The skill uses `devspace agents targets`, `run`, `continue`, `show`, `wait`, and `ls`.
These commands do not require `devspace serve`.

This Coding Agent installation is separate from ChatGPT MCP usage. For MCP
workspaces with Subagents enabled, DevSpace manages its own copy at
`~/.devspace/skills/subagents/SKILL.md`; users do not install that copy
manually.

### Connect ChatGPT

If you selected ChatGPT, setup offers OpenAI secure MCP tunnel or public HTTPS.
A Coding Agents-only setup skips this section. Existing installations can run
`npx @waishnav/devspace init --force` to switch connection methods.

#### OpenAI secure MCP tunnel

1. Download and extract the official [tunnel-client release](https://github.com/openai/tunnel-client/releases)
   for your platform. DevSpace asks for its executable name or path; it does not
   install the binary.
2. Create or select a tunnel in [OpenAI Platform Tunnels](https://platform.openai.com/settings/organization/tunnels).
   Create a regular [runtime API key](https://platform.openai.com/settings/organization/api-keys)
   whose principal has Tunnels Read and Use permissions. Do not use an admin key.
3. Select the OpenAI option during initialization and provide the tunnel ID,
   binary path, and runtime key. The key is entered as a password and saved in
   `auth.json`, together with a generated secret for local MCP authentication.
4. Run `npx @waishnav/devspace serve`. It starts the official client against the
   local MCP endpoint and stops its own client when the server stops. You retain
   ownership of the remote tunnel and its credentials.
5. Enable Developer Mode in ChatGPT settings, create an app with connection type
   **Tunnel**, select that tunnel, and choose **Authentication: None**. Allow the
   actions you intend to use according to your workspace's permissions.

No public URL is required. DevSpace listens on loopback and the client injects
an independent secret into local MCP requests. Embedded tool cards are disabled
at runtime because this tunnel transports MCP rather than arbitrary web assets;
the configured coding tools remain available and `ui.enabled` is not rewritten.
Starting the client is not confirmation that ChatGPT has connected: check tool
discovery and a real workspace call in your ChatGPT session.

See [OpenAI's secure MCP tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
for account access and provisioning. This integration follows the official-client
approach used by [codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web),
with DevSpace's existing Streamable HTTP server as the local MCP target.

#### Public HTTPS

Start your tunnel or reverse proxy first and point it at:

```text
http://127.0.0.1:7676
```

For Tailscale Funnel, proxy the whole DevSpace server from the root path:

```bash
tailscale funnel --bg 7676
```

Do not mount Funnel only at `/mcp` with `--set-path=/mcp`. DevSpace also serves
OAuth discovery and authorization routes outside `/mcp`, and a path mount can
strip `/mcp` before the request reaches DevSpace.

Enter the public origin without `/mcp`:

```text
https://your-tunnel-host.example.com
```

Configure the MCP client with the full MCP endpoint:

```text
https://your-tunnel-host.example.com/mcp
```

Protocol compatibility is automatic. DevSpace serves MCP 2026-07-28 requests
directly and handles older 2025-era clients statelessly on the same endpoint;
there is no client-protocol setting to maintain.

## Start The Server

Run:

```bash
npx @waishnav/devspace serve
```

For public HTTPS, if your tunnel URL changes, update the persisted value before starting:

```bash
npx @waishnav/devspace config set publicBaseUrl https://devspace.example.com
npx @waishnav/devspace serve
```

## Approve The Client

For public HTTPS connections, DevSpace shows an Owner password approval page.
Enter the Owner password printed during setup. OpenAI tunnel connections use
the tunnel and local secret instead, so they do not show this OAuth page.

The default config files are:

```text
~/.devspace/config.jsonc
~/.devspace/auth.json
```

Keep `auth.json` private.

## Manage Project Access

Use the project list to manage allowed folders without rerunning initialization:

```bash
devspace projects                  # List allowed folders (also: projects ls)
devspace projects add ~/physicsnemo ~/another-project
devspace projects rm ~/physicsnemo # Also: projects remove
```

Paths can be absolute, relative to the current directory, or start with `~`.
Adding a folder requires an existing directory and resolves symbolic links;
repeated additions do not create duplicates. Removal accepts the folder path,
including a folder that no longer exists, and never deletes project files.
The displayed numbers are for reference; remove by path.

Each allowed folder grants access to its descendants. If a removed project is
still inside another allowed folder, the command reports that it remains
accessible. To restrict access to individual projects, remove the broad parent
entry and add only the intended project folders. Removing every entry leaves
no allowed project folders.

Changes take effect on the next authenticated MCP request without restarting
the server. They do not stop commands or subagents that have already started.
Allowed folders restrict MCP workspace and filesystem access; shell commands
still run with the local user's authority and are not a filesystem sandbox.

## Check Your Setup

Run:

```bash
npx @waishnav/devspace doctor
```

The doctor command reports the resolved config, Node version, Node ABI, platform,
Git, Bash, public URL, allowed hosts, and SQLite native dependency status.

## Running From A Local Checkout

If you are developing DevSpace itself instead of using the published package:

Local checkout development additionally requires pnpm 11.25.0, the version
pinned in `package.json`. Install it with `npm install --global pnpm@11.25.0`.

```bash
pnpm install --frozen-lockfile
pnpm dev:seed
pnpm dev
```

The source server uses an ignored checkout-local fork of your normal DevSpace
configuration and SQLite state. See [Development and Manual QA](development.md)
for worktree switching, ChatGPT testing, and database migration workflows.
