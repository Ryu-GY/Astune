import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentAuthEnabled, EnvironmentConfigurationError, getAstronomyConfig, getAuthOrigin,
  getDatabaseConfig, getGoogleAuthConfig, getRuleSource } from "../src/lib/config/env";

test("database configuration supports SQLite and PostgreSQL, and never defaults production to a local DB", () => {
  assert.deepEqual(getDatabaseConfig({}), { url: "file:./dev.db", provider: "sqlite" });
  assert.equal(getDatabaseConfig({ DATABASE_URL: "file:C:/temp/test.db" }).provider, "sqlite");
  assert.equal(getDatabaseConfig({ DATABASE_URL: "postgresql://test:password@localhost:5432/astune" }).provider, "postgresql");
  for (const DATABASE_URL of ["file:", "https://example.test/db", "postgresql:///db", "postgresql://localhost"]) {
    assert.throws(() => getDatabaseConfig({ DATABASE_URL }), EnvironmentConfigurationError);
  }
  assert.throws(() => getDatabaseConfig({ NODE_ENV: "production" }), { keys: ["DATABASE_URL"] });
});

test("OAuth config is optional for guests but partial or invalid credentials fail without exposing values", () => {
  assert.equal(getGoogleAuthConfig({ BETTER_AUTH_URL: "http://localhost:3000", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", BETTER_AUTH_SECRET: "" }), null);
  const config = { NODE_ENV: "production", BETTER_AUTH_URL: "https://astune.example.test/",
    BETTER_AUTH_SECRET: "synthetic-auth-secret-with-at-least-32-characters", GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" };
  assert.equal(getGoogleAuthConfig(config)?.origin, "https://astune.example.test");
  for (const overrides of [{ GOOGLE_CLIENT_SECRET: "" }, { BETTER_AUTH_SECRET: "too-short-sensitive-value" }, { BETTER_AUTH_SECRET: " ".repeat(40) }, { BETTER_AUTH_URL: "invalid-private-value" }]) {
    assert.throws(() => getGoogleAuthConfig({ ...config, ...overrides }), error => {
      assert(error instanceof EnvironmentConfigurationError);
      for (const value of Object.values(overrides)) if (value) assert(!error.message.includes(value));
      return true;
    });
  }
});

test("auth origins reject opaque URLs, embedded credentials and non-local production HTTP", () => {
  for (const BETTER_AUTH_URL of ["null", "data:text/plain,test", "https://user:password@example.test", "https://example.test/path", "https://example.test?token=private", "http://example.test"]) {
    assert.throws(() => getAuthOrigin({ NODE_ENV: "production", BETTER_AUTH_URL }), EnvironmentConfigurationError);
  }
  assert.equal(getAuthOrigin({ NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3471" }), "http://localhost:3471");
});

test("development identities require explicit local development and stay off in production and deployments", () => {
  const dev = { NODE_ENV: "development", ASTUNE_ALLOW_DEV_AUTH: "1" };
  assert.equal(developmentAuthEnabled(dev), true);
  for (const overrides of [{ NODE_ENV: "production" }, { NODE_ENV: "test" }, { NODE_ENV: undefined }, { ASTUNE_ALLOW_DEV_AUTH: "0" }, { VERCEL: "1" }, { RENDER: "true" }]) {
    assert.equal(developmentAuthEnabled({ ...dev, ...overrides }), false);
  }
});

test("astronomy configuration validates endpoints and timeout bounds before making network calls", () => {
  assert.equal(getAstronomyConfig(15000, {}).timeoutMs, 15000);
  assert.equal(getAstronomyConfig(15000, { ASTUNE_ASTRO_TIMEOUT_MS: "120000" }).timeoutMs, 120000);
  for (const ASTUNE_ASTRO_TIMEOUT_MS of ["0", "999", "120001", "NaN", "1000.5"]) {
    assert.throws(() => getAstronomyConfig(15000, { ASTUNE_ASTRO_TIMEOUT_MS }), EnvironmentConfigurationError);
  }
  assert.throws(() => getAstronomyConfig(15000, { ASTUNE_ASTRO_API_URL: "file:/private" }), EnvironmentConfigurationError);
});

test("a misspelled rule source fails instead of silently falling back to builtin readings", () => {
  assert.equal(getRuleSource({}), "builtin");
  assert.equal(getRuleSource({ ASTUNE_RULE_SOURCE: "database" }), "database");
  assert.throws(() => getRuleSource({ ASTUNE_RULE_SOURCE: "databse" }), EnvironmentConfigurationError);
});
