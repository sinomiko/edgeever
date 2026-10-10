import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decideUpstreamSync } from "./upstream-sync-plan.mjs";

test("this deployment preserves the color compatibility patch during updates", () => {
  const workflow = readFileSync(new URL("../.github/workflows/sync-edgeever-upstream.yml", import.meta.url), "utf8");
  expect(workflow).toContain("PRESERVE_FORK_CHANGES: 'true'");
  const state = {
    preserveForkChanges: true, contentMatchesTarget: false, forceRedeploy: false,
    headEqualsTarget: false, headIsAncestorOfTarget: false, targetIsAncestorOfHead: false,
  };
  expect(decideUpstreamSync(state).alignMode).toBe("merge");
  expect(decideUpstreamSync({ ...state, targetIsAncestorOfHead: true }).updateRequired).toBe(false);
});
