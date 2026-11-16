import { vi } from "vitest";
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { SetupModelAuthCandidate } from "./setup.model-auth.js";

export function agentConfig(agents: NonNullable<OpenClawConfig["agents"]> = {}): OpenClawConfig {
  return {
    agents: {
      defaults: { workspace: "/tmp/global-workspace" },
      entries: { ops: { agentDir: "/tmp/ops-agent", workspace: "/tmp/ops-workspace" } },
      ...agents,
    },
  };
}

export function authCandidate(
  config: OpenClawConfig,
  authProfiles: SetupModelAuthCandidate["authProfiles"] = [],
) {
  return { config, authProfiles, persistAuthProfiles: vi.fn(async () => {}) };
}

export function createEmptyWizardPrompter() {
  return createWizardPrompter({
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
    select: vi.fn(),
    multiselect: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
  });
}
