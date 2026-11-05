/**
 * One command from source to an installable debug APK:
 *
 *   npm run android:apk:debug
 *
 * In order: validate the levels and build the latest web assets (`npm run build`), copy them into the Android project
 * (`cap sync android`), run Gradle's `assembleDebug`, then check that the APK exists, is not empty and carries the
 * expected application id and version. It prints the real output path and copies the APK to artifacts/ (git-ignored).
 *
 * Needs JDK 21 and the Android SDK. JAVA_HOME and ANDROID_HOME are used when they are right; otherwise a JDK 21 is
 * looked for on PATH and in the usual install folders, and android/local.properties is written from ANDROID_HOME.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
const isWindows = process.platform === 'win32';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const APP_ID = 'com.portfolio.orbitshift';
const apkPath = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function fail(message) {
  process.stderr.write(`\n${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: isWindows, ...options });
  if (result.status !== 0) fail(`"${command} ${args.join(' ')}" failed (exit ${result.status ?? 'none'}).`);
}

function javaMajor(home) {
  const exe = join(home, 'bin', isWindows ? 'java.exe' : 'java');
  if (!existsSync(exe)) return 0;
  const out = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  const match = /version "(\d+)/.exec(`${out.stderr}${out.stdout}`);
  return match ? Number(match[1]) : 0;
}

function jdkCandidates() {
  const found = [process.env.JAVA_HOME].filter(Boolean);
  const where = spawnSync(isWindows ? 'where' : 'which', ['java'], { encoding: 'utf8' });
  if (where.status === 0) found.push(dirname(dirname(where.stdout.split(/\r?\n/)[0].trim())));
  const bases = [
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Eclipse Adoptium'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Java'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Microsoft'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'CodexDevTools', 'java'),
    '/usr/lib/jvm',
  ].filter((dir) => dir && existsSync(dir));
  for (const base of bases) for (const name of readdirSync(base)) found.push(join(base, name));
  return found;
}

/** Capacitor 8's Android build needs JDK 21 or newer. */
function pickJdk() {
  const home = jdkCandidates().find((candidate) => javaMajor(candidate) >= 21);
  if (!home) fail('No JDK 21 found. Install one (for example Temurin 21) and set JAVA_HOME to it, then run again.');
  return home;
}

function sdkRoot() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  const sdk = candidates.find((dir) => existsSync(join(dir, 'platforms')));
  if (!sdk) fail('No Android SDK found. Set ANDROID_HOME to the SDK folder (it must contain "platforms").');
  return sdk;
}

function ensureLocalProperties(sdk) {
  const file = join(androidDir, 'local.properties');
  writeFileSync(file, `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);
}

function latestBuildTool(sdk, tool) {
  const dir = join(sdk, 'build-tools');
  const newestFirst = (a, b) => b.localeCompare(a, undefined, { numeric: true });
  const versions = existsSync(dir) ? readdirSync(dir).sort(newestFirst) : [];
  const exe = versions.map((v) => join(dir, v, isWindows ? `${tool}.exe` : tool)).find((p) => existsSync(p));
  return exe ?? null;
}

function verifyApk(sdk) {
  if (!existsSync(apkPath)) fail(`Gradle finished but no APK was found at ${apkPath}`);
  const size = statSync(apkPath).size;
  if (size < 100_000) fail(`The APK at ${apkPath} is suspiciously small (${size} bytes).`);
  const aapt2 = latestBuildTool(sdk, 'aapt2');
  if (!aapt2) {
    process.stdout.write('\nNote: aapt2 not found, so the application id and version were not read back from the APK.\n');
    return { size, id: null, version: null };
  }
  const out = spawnSync(aapt2, ['dump', 'badging', apkPath], { encoding: 'utf8' }).stdout;
  const match = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(out);
  if (!match) fail('Could not read the package line from the APK.');
  const [, id, code, version] = match;
  if (id !== APP_ID) fail(`Application id is ${id}, expected ${APP_ID}.`);
  if (version !== pkg.version) fail(`APK versionName ${version} does not match package.json ${pkg.version}.`);
  return { size, id, version, code };
}

function publish() {
  const outDir = join(root, 'artifacts');
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, `OrbitShift-${pkg.version}-debug.apk`);
  copyFileSync(apkPath, target);
  const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
  writeFileSync(`${target}.sha256`, `${hash} *${target.split(/[\\/]/).pop()}\n`);
  return { target, hash };
}

const startedAt = Date.now();
process.stdout.write('1/4  Validating levels and building the web assets...\n');
run('npm', ['run', 'build']);
process.stdout.write('\n2/4  Syncing the build into the Android project...\n');
if (!existsSync(androidDir)) run('npx', ['cap', 'add', 'android']);
run('npx', ['cap', 'sync', 'android']);
const sdk = sdkRoot();
const jdk = pickJdk();
ensureLocalProperties(sdk);
process.stdout.write(`\n3/4  Running Gradle assembleDebug (JDK ${javaMajor(jdk)} at ${jdk})...\n`);
const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
const [gradle, gradleArgs] = isWindows ? ['.\\gradlew.bat', ['assembleDebug']] : ['sh', ['./gradlew', 'assembleDebug']];
run(gradle, gradleArgs, { cwd: androidDir, env });
process.stdout.write('\n4/4  Checking the APK...\n');
const info = verifyApk(sdk);
const { target, hash } = publish();
process.stdout.write(
  `\nBuilt:      ${apkPath}\nCopied to:  ${target}\nSize:       ${(info.size / 1048576).toFixed(2)} MB\n` +
    `Package:    ${info.id ?? 'not checked'}   version ${info.version ?? 'not checked'} (code ${info.code ?? '?'})\n` +
    `SHA-256:    ${hash}\nTook:       ${Math.round((Date.now() - startedAt) / 1000)} s\n\n` +
    `Install on a connected phone:  adb install -r "${target}"\n`,
);
