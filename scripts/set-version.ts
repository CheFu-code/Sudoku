/**
 * Sync app.json's marketing version from a release tag. Run in CI on a tag push:
 *
 *   npx tsx scripts/set-version.ts v1.2.0     # explicit tag
 *   GITHUB_REF_NAME=v1.2.0 npx tsx scripts/set-version.ts
 *   npm run set-version v1.2.0
 *
 * Strips a leading "v", validates the tag is plain semver (X.Y.Z), and writes it
 * to expo.version in app.json. The build number (CFBundleVersion / versionCode)
 * is NOT touched here — EAS auto-increments it (appVersionSource: remote,
 * autoIncrement: true). The git tag is the single source of truth for the
 * marketing version; this edit is not committed back.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(message: string): never {
  console.error(`set-version: ${message}`);
  process.exit(1);
}

const rawTag = (process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '').trim();
if (!rawTag) {
  fail('no tag provided (pass an argument or set GITHUB_REF_NAME), e.g. v1.2.0');
}

const version = rawTag.replace(/^v/, '');
if (!SEMVER.test(version)) {
  fail(`tag "${rawTag}" is not a valid vX.Y.Z version`);
}

const appJsonPath = path.resolve(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')) as {
  expo?: { version?: string };
};

if (!config.expo) {
  fail('app.json has no "expo" key');
}

const previous = config.expo.version;
config.expo.version = version;

fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');
console.log(`set-version: app.json version ${previous ?? '(unset)'} -> ${version}`);
