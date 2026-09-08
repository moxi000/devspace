import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { expandHomePath, isPathInsideRoot } from "./roots.js";
import { loadDevspaceFiles, setDevspaceConfigValue } from "./user-config.js";

function canonicalIfPresent(path: string): string {
  try {
    return realpathSync.native(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return path;
    throw error;
  }
}

export function runProjectsCommand(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): void {
  const [command = "list", ...paths] = args;
  const files = loadDevspaceFiles(env);
  const roots = files.config.workspaces.allowedRoots;
  if (command === "list" || command === "ls") {
    if (paths.length) throw new Error("Usage: devspace projects [list|ls]");
    console.log(`Allowed project folders (${files.configPath}):`);
    if (!roots.length) console.log("  (none)");
    roots.forEach((root, index) => console.log(`  ${index + 1}. ${root}`));
    return;
  }
  if (!["add", "remove", "rm"].includes(command) || !paths.length) {
    throw new Error("Usage: devspace projects [list|ls|add <path...>|remove <path...>|rm <path...>]");
  }
  const absolute = (path: string) => resolve(cwd, expandHomePath(path));
  const requested = paths.map(absolute);
  let updated: string[];
  if (command === "add") {
    const additions = requested.map((path) => {
      const canonical = realpathSync.native(path);
      if (!statSync(canonical).isDirectory()) throw new Error(`Not a directory: ${path}`);
      return canonical;
    });
    updated = [...roots];
    const existing = new Set(roots.map((root) => canonicalIfPresent(absolute(root))));
    for (const path of additions) {
      if (!existing.has(path)) {
        updated.push(path);
        existing.add(path);
      }
    }
  } else {
    const matching = requested.map((path) => roots.filter((root) =>
      absolute(root) === path || canonicalIfPresent(absolute(root)) === canonicalIfPresent(path),
    ));
    const missing = requested.filter((_, index) => !matching[index]!.length);
    if (missing.length) throw new Error(`Not in allowed project folders: ${missing.join(", ")}`);
    const removed = new Set(matching.flat());
    updated = roots.filter((root) => !removed.has(root));
    for (const path of requested) {
      const parent = updated.find((root) => isPathInsideRoot(canonicalIfPresent(path), canonicalIfPresent(absolute(root))));
      if (parent) console.log(`Note: ${path} remains accessible through allowed parent folder ${parent}.`);
    }
  }
  if (JSON.stringify(updated) !== JSON.stringify(roots)) {
    setDevspaceConfigValue(["workspaces", "allowedRoots"], updated, env);
    console.log(`Updated ${files.configPath}`);
  } else {
    console.log("Project folders already allowed; no changes.");
  }
}
