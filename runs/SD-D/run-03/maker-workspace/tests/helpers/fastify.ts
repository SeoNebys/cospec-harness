import path from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { type AppDependencies, buildApp } from "../../src/server/app.js";
import { type AppConfig, loadConfig } from "../../src/server/config.js";
import { createTestClock, type TestClock } from "./clock.js";
import { createTestDatabase, type TestDatabase, type TestDatabaseOptions } from "./database.js";

export const TEST_APP_HOST = "bookmark.test";
export const TEST_APP_ORIGIN = `http://${TEST_APP_HOST}`;

export type TestAppFactory = (
  dependencies: AppDependencies,
) => FastifyInstance | Promise<FastifyInstance>;

export interface FastifyHarnessOptions {
  clock?: TestClock;
  database?: TestDatabaseOptions;
  config?: Partial<Omit<AppConfig, "metadata">> & {
    metadata?: Partial<AppConfig["metadata"]>;
  };
  build?: TestAppFactory;
  beforeBuild?: (database: TestDatabase) => void | Promise<void>;
}

export interface FastifyTestHarness {
  app: FastifyInstance;
  config: AppConfig;
  clock: TestClock;
  testDatabase: TestDatabase;
  inject: (options: InjectOptions) => Promise<LightMyRequestResponse>;
  injectJson: (options: InjectOptions) => Promise<LightMyRequestResponse>;
  close: () => Promise<void>;
}

function makeConfig(
  testDatabase: TestDatabase,
  overrides: FastifyHarnessOptions["config"],
): AppConfig {
  const base = loadConfig(
    {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "4000",
      DATABASE_PATH: testDatabase.databasePath,
      CLIENT_DIRECTORY: path.join(testDatabase.directory, "client-not-built"),
    },
    testDatabase.directory,
  );

  return {
    ...base,
    ...overrides,
    metadata: { ...base.metadata, ...overrides?.metadata },
  };
}

export async function createFastifyTestHarness(
  options: FastifyHarnessOptions = {},
): Promise<FastifyTestHarness> {
  const testDatabase = createTestDatabase(options.database);
  const clock = options.clock ?? createTestClock();
  let app: FastifyInstance | undefined;
  let closed = false;

  try {
    await options.beforeBuild?.(testDatabase);
    const config = makeConfig(testDatabase, options.config);
    app = await (options.build ?? buildApp)({
      config,
      database: testDatabase.database,
      now: clock.now,
    });
    await app.ready();
    const readyApp = app;

    const inject = (injectOptions: InjectOptions) => readyApp.inject(injectOptions);
    const injectJson = (injectOptions: InjectOptions) =>
      readyApp.inject({
        ...injectOptions,
        headers: {
          host: TEST_APP_HOST,
          origin: TEST_APP_ORIGIN,
          ...(injectOptions.payload === undefined ? {} : { "content-type": "application/json" }),
          ...injectOptions.headers,
        },
      });

    return {
      app: readyApp,
      config,
      clock,
      testDatabase,
      inject,
      injectJson,
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await readyApp.close();
        } finally {
          testDatabase.cleanup();
        }
      },
    };
  } catch (error) {
    await app?.close();
    testDatabase.cleanup();
    throw error;
  }
}

export async function withFastifyTestHarness<T>(
  run: (harness: FastifyTestHarness) => T | Promise<T>,
  options: FastifyHarnessOptions = {},
): Promise<T> {
  const harness = await createFastifyTestHarness(options);
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
}
