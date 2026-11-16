import { vi } from "vitest";
import {
  assertBrowserNavigationResultAllowed,
  withBrowserNavigationPolicy,
} from "../navigation-guard.js";
import type { BrowserRouteContext } from "../server-context.js";
import type { BrowserRequest, BrowserResponse } from "./types.js";

const makeTab = () => ({ targetId: "7", url: "https://example.com" });
type SafeUrlRequest = Parameters<typeof import("./agent.shared.js").resolveSafeRouteTabUrl>[0];

export const existingSessionRouteState = {
  profileCtx: {
    profile: { driver: "existing-session" as const, name: "chrome-live" },
    listTabs: vi.fn(async () => [makeTab()]),
    ensureTabAvailable: vi.fn(async () => makeTab()),
    closeTab: vi.fn(async () => {}),
  },
  tab: makeTab(),
};

export function createExistingSessionAgentSharedModule() {
  return {
    browserNavigationPolicyForProfile: vi.fn((ctx: BrowserRouteContext) =>
      withBrowserNavigationPolicy(ctx.state().resolved.ssrfPolicy),
    ),
    handleRouteError: vi.fn((res: BrowserResponse, err: unknown) => {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }),
    readBody: vi.fn((req: BrowserRequest) => req.body ?? {}),
    requirePwAi: vi.fn(async () => {
      throw new Error("Playwright should not be used for existing-session tests");
    }),
    resolveProfileContext: vi.fn(() => existingSessionRouteState.profileCtx),
    resolveSafeRouteTabUrl: vi.fn(async (params: SafeUrlRequest) => {
      const tabs = await params.profileCtx.listTabs();
      return tabs.find((tab) => tab.targetId === params.targetId)?.url ?? params.fallbackUrl;
    }),
    withPlaywrightRouteContext: vi.fn(),
    withRouteTabContext: vi.fn(
      async (options: {
        ctx: BrowserRouteContext;
        enforceCurrentUrlAllowed?: boolean;
        req: BrowserRequest;
        run: (args: unknown) => Promise<void>;
      }) => {
        const { ctx, enforceCurrentUrlAllowed, req, run } = options;
        const policy = enforceCurrentUrlAllowed ? ctx.state().resolved.ssrfPolicy : undefined;
        if (policy) {
          await assertBrowserNavigationResultAllowed({
            url: existingSessionRouteState.tab.url,
            ...withBrowserNavigationPolicy(policy),
          });
        }
        await run({
          profileCtx: existingSessionRouteState.profileCtx,
          cdpUrl: "http://127.0.0.1:18800",
          tab: existingSessionRouteState.tab,
          signal: req.signal ?? new AbortController().signal,
          resolveTabUrl: vi.fn(
            async (fallbackUrl?: string) => fallbackUrl ?? existingSessionRouteState.tab.url,
          ),
        });
      },
    ),
  };
}

export async function launchChromiumRoutePage(profileDir: string, args: string[] = []) {
  const { readTargetId } = await import("../pw-chromium.test-support.js");
  const { getFreePort } = await import("../test-port.js");
  const { getPlaywrightCore } = await import("../playwright-core.runtime.js");
  const port = await getFreePort();
  const cdpUrl = `http://127.0.0.1:${port}`;
  const context = await getPlaywrightCore().chromium.launchPersistentContext(profileDir, {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: [`--remote-debugging-port=${port}`, ...args],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, cdpUrl, targetId: await readTargetId(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}
