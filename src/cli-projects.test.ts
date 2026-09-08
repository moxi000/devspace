import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runProjectsCommand } from "./cli-projects.js";
import { loadDevspaceFiles, setDevspaceConfigValue } from "./user-config.js";

test("projects manages canonical directories without deleting project files", () => {
  const dir = mkdtempSync(join(tmpdir(), "devspace-projects-"));
  const env = { DEVSPACE_CONFIG_DIR: join(dir, "config") };
  const project = join(dir, "project");
  const child = join(project, "child");
  const messages: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => { messages.push(args.join(" ")); };
  try {
    mkdirSync(child, { recursive: true });
    runProjectsCommand(["add", "project", project], env, dir);
    const roots = () => loadDevspaceFiles(env).config.workspaces.allowedRoots;
    assert.deepEqual(roots(), [realpathSync.native(project)]);
    runProjectsCommand([], env, dir);
    assert.ok(messages.some((line) => line.includes(`1. ${realpathSync.native(project)}`)));
    runProjectsCommand(["add", child], env, dir);
    runProjectsCommand(["rm", child], env, dir);
    assert.ok(messages.some((line) => line.includes("remains accessible")));
    assert.throws(() => runProjectsCommand(["rm", project, join(dir, "missing")], env, dir), /Not in allowed/);
    assert.deepEqual(roots(), [realpathSync.native(project)]);
    assert.throws(() => runProjectsCommand(["add", join(dir, "missing")], env, dir), /ENOENT/);
    if (process.platform !== "win32") {
      const alias = join(dir, "alias");
      symlinkSync(project, alias, "dir");
      runProjectsCommand(["add", alias], env, dir);
      assert.equal(roots().length, 1);
      runProjectsCommand(["remove", alias], env, dir);
    } else {
      runProjectsCommand(["remove", project], env, dir);
    }
    assert.deepEqual(roots(), []);
    assert.equal(realpathSync.native(project), realpathSync.native(join(dir, "project")));
    const vanished = join(dir, "vanished");
    setDevspaceConfigValue(["workspaces", "allowedRoots"], [vanished], env);
    runProjectsCommand(["rm", vanished], env, dir);
    assert.deepEqual(roots(), []);
  } finally {
    console.log = originalLog;
    rmSync(dir, { recursive: true, force: true });
  }
});
