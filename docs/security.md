# Security Model

DevSpace exposes local coding capabilities over MCP. Treat it as remote access
to your development machine.

The security model is simple:

- you choose a narrow filesystem allowlist
- the MCP endpoint requires OAuth approval with your Owner password, or a
  dedicated local secret in OpenAI tunnel mode
- Host headers are allowlisted from the local host and configured public URL
- every coding action happens through explicit MCP tool calls

## Filesystem Allowlist

DevSpace only opens workspaces under configured roots.

Good examples:

```text
~/work
~/personal/open-source
```

Avoid broad roots:

```text
~
/
C:\
```

The narrower the root, the easier it is to reason about what the MCP client can
reach.

## Owner Password

`devspace init` generates an Owner password and stores it in:

```text
~/.devspace/auth.json
```

For public HTTPS or ordinary local OAuth connections, DevSpace shows an approval page. Enter the Owner
password only when you intentionally want that client to access this server.

For env-driven deployments, set a long random value:

```bash
DEVSPACE_OAUTH_OWNER_TOKEN="$(openssl rand -base64 32)"
```

## Public URL And Host Allowlist

Public HTTPS deployments need `server.publicBaseUrl` in `config.jsonc` so MCP clients can
discover OAuth metadata and connect to the correct resource.

The value should be the origin only:

```text
https://your-tunnel-host.example.com
```

Do not include `/mcp` in `server.publicBaseUrl`.

By default, DevSpace derives allowed Host headers from the local host and public
URL. Put `"*"` in `server.allowedHosts` only for intentional local debugging.

## Tunnels

For the official OpenAI option, `devspace serve` starts the installed
`tunnel-client` and stops only that child when the server stops. You create and
manage the remote tunnel and runtime API key in OpenAI Platform. DevSpace does
not provision remote tunnels or install the client.

OpenAI tunnel mode requires a loopback listener and `publicBaseUrl: null`.
The ordinary runtime key authenticates the client to OpenAI; a separate generated
secret authenticates the client to DevSpace through a static MCP request header.
Both are stored in `auth.json` and can be overridden with
`DEVSPACE_TUNNEL_API_KEY` and `DEVSPACE_TUNNEL_SECRET`. Secrets are passed to the
child through its environment rather than command-line arguments. Keep that
file and your local account private.

ChatGPT uses **Tunnel** with **Authentication: None** in this mode. That setting
skips DevSpace's browser OAuth flow; it does not make the local MCP endpoint
unauthenticated. The OpenAI tunnel carries MCP traffic without publishing the
server's web assets, so embedded tool cards are disabled at runtime. File and
shell authority remain the same.

For public HTTPS, you manage your own tunnel or reverse proxy. Point it to:

```text
http://127.0.0.1:7676
```

Prefer adding Cloudflare Access, Tailscale identity controls, or equivalent
protection in front of public tunnels. DevSpace OAuth still protects the MCP
endpoint, but the tunnel URL should not be treated as a secret.

## Shell Access

The shell tool is powerful by design. It is meant for tests, builds, git, and
package scripts.

Filesystem path containment applies to DevSpace file tools. Shell commands run
as local commands and can do what your user account can do. This is why the MCP
client must be trusted and the Owner password and tunnel credentials must stay private.

## Worktrees

Managed worktrees reduce accidental edits to your active checkout, but they are
not a security boundary. They are a workflow boundary for isolated coding
sessions.

## Native File Download

Native file download is an opt-in, one-shot transfer into an already-open
workspace. `download_artifact` accepts the MCP host's native file value, the
`workspaceId` returned by `open_workspace`, and an unused relative destination
path. It returns only the workspace-relative path and does not create a
persistent artifact service or reusable artifact ID.

DevSpace accepts only the documented native-file object and trusted OpenAI
download hosts and redirects. Arbitrary URL strings, local source paths,
credentials, malformed references, and unknown object fields are rejected.

Absolute paths, traversal, symlinked parents, and existing destinations also
fail closed. Downloads stream under the configured per-file limit and are
published without overwrite as owner-only files. DevSpace does not extract or
execute transferred content.

## Logs

By default, DevSpace logs requests and tool calls. Shell command previews are
disabled unless `logging.shellCommands` is `true`.

Do not enable shell command logging if commands may contain secrets.

Artifact tool logs contain bounded workspace ID, validated hostname,
workspace-relative output path, byte count, hash, duration, and status metadata.
`download_artifact` does not log the opaque file value. Raw content, connector
references, native file IDs, bearer credentials, presigned URLs, host paths,
temporary paths, and base64 chunks are never included in tool logs or tool
results.
