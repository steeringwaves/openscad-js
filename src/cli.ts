#!/usr/bin/env node
/* eslint-disable max-classes-per-file */
/**
 * js2scad - run a javascript/typescript openscad-js model so it writes its
 * `.scad` output, optionally re-running it whenever a source file changes.
 *
 * The model itself is what decides where the output lands (by calling
 * `scad.toScadFile(__filename)` or `scad.toFile(...)`), this cli just takes
 * care of booting node with the right loaders and watching for changes.
 *
 * All cli chatter goes to stderr so the model is still free to print the
 * generated scad on stdout.
 */

import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

interface IOptions {
	entry: string;
	scriptArgs: string[];
	watch: boolean;
	transpileOnly: boolean;
	clear: boolean;
	quiet: boolean;
	cwd: string;
}

interface IRunResult {
	code: number;
	deps: string[];
	durationMs: number;
}

const useColor = Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;

const paint = (code: string, str: string): string => (useColor ? `\u001b[${code}m${str}\u001b[0m` : str);
const dim = (str: string): string => paint("2", str);
const red = (str: string): string => paint("31", str);
const green = (str: string): string => paint("32", str);
const cyan = (str: string): string => paint("36", str);

function log(...args: any[]): void {
	console.error(...args);
}

function fail(message: string): never {
	log(`${red("error")} ${message}`);
	process.exit(1);
}

function version(): string {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
		return pkg.version || "unknown";
	} catch (err) {
		return "unknown";
	}
}

function usage(): string {
	return `js2scad - compile/run an openscad-js model

usage:
  js2scad [options] <file> [-- <model args>]

options:
  -w, --watch            re-run whenever the model or one of its local imports changes
  -T, --transpile-only   skip typescript type checking (much faster rebuilds)
  -C, --cwd <dir>        working directory used to run the model (default: current directory)
  -c, --clear            clear the screen before each re-run (watch mode only)
  -q, --quiet            only report failures
  -h, --help             show this help
  -v, --version          show the js2scad version

examples:
  js2scad jscad/models/example1/example1.ts
  js2scad --watch --transpile-only jscad/models/example1/example1.ts
  js2scad model.ts -- --width 40`;
}

/**
 * Splits a grouped short flag (-wT) into individual flags so they can be
 * handled one at a time.
 */
function expandArgs(argv: string[]): string[] {
	const expanded: string[] = [];
	let passthrough = false;

	argv.forEach((arg) => {
		if (passthrough) {
			expanded.push(arg);
			return;
		}

		if ("--" === arg) {
			passthrough = true;
			expanded.push(arg);
			return;
		}

		if (/^-[a-zA-Z]{2,}$/.test(arg)) {
			arg.slice(1)
				.split("")
				.forEach((flag) => expanded.push(`-${flag}`));
			return;
		}

		expanded.push(arg);
	});

	return expanded;
}

function parseArgs(argv: string[]): IOptions {
	const opts: IOptions = {
		entry: "",
		scriptArgs: [],
		watch: false,
		transpileOnly: false,
		clear: false,
		quiet: false,
		cwd: process.cwd()
	};

	const args = expandArgs(argv);
	let entry = "";

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];

		if ("--" === arg) {
			opts.scriptArgs = args.slice(i + 1);
			break;
		}

		switch (arg) {
			case "-h":
			case "--help":
				log(usage());
				process.exit(0);
				break;

			case "-v":
			case "-V":
			case "--version":
				log(version());
				process.exit(0);
				break;

			case "-w":
			case "--watch":
				opts.watch = true;
				break;

			case "-T":
			case "--transpile-only":
				opts.transpileOnly = true;
				break;

			case "-c":
			case "--clear":
				opts.clear = true;
				break;

			case "-q":
			case "--quiet":
				opts.quiet = true;
				break;

			case "-C":
			case "--cwd":
				i += 1;
				if (!args[i]) {
					fail(`${arg} requires a directory`);
				}
				opts.cwd = path.resolve(args[i]);
				break;

			default:
				if ("-" === arg.charAt(0) && arg.length > 1) {
					fail(`unknown option ${arg}\n\n${usage()}`);
				}

				if (entry) {
					fail(`unexpected argument ${arg} (pass model arguments after --)`);
				}

				entry = arg;
				break;
		}
	}

	if (!entry) {
		fail(`no model file given\n\n${usage()}`);
	}

	opts.entry = resolveEntry(entry, opts.cwd);

	return opts;
}

/**
 * Resolves the model path, allowing the extension to be left off and a
 * directory to point at its index file. The path is taken as relative to the
 * shell first and to --cwd second, so both readings of it work.
 */
function resolveEntry(entry: string, cwd: string): string {
	const roots = cwd === process.cwd() ? [cwd] : [process.cwd(), cwd];
	const candidates: string[] = [];

	roots.forEach((root) => {
		const target = path.resolve(root, entry);

		if (isDirectory(target)) {
			candidates.push(path.join(target, "index.ts"), path.join(target, "index.js"));
			return;
		}

		candidates.push(target);

		if (!path.extname(target)) {
			candidates.push(`${target}.ts`, `${target}.js`);
		}
	});

	const found = candidates.find((candidate) => isFile(candidate));

	if (!found) {
		fail(`cannot find model ${entry}`);
	}

	return found as string;
}

function isFile(target: string): boolean {
	try {
		return fs.statSync(target).isFile();
	} catch (err) {
		return false;
	}
}

function isDirectory(target: string): boolean {
	try {
		return fs.statSync(target).isDirectory();
	} catch (err) {
		return false;
	}
}

/**
 * Builds the list of modules to preload in the child process, ts-node for
 * typescript models and (in watch mode) the dependency tracking hook.
 */
function buildRequires(opts: IOptions, depsFile: string): string[] {
	const requires: string[] = [];
	const ext = path.extname(opts.entry).toLowerCase();

	if (".ts" === ext || ".tsx" === ext) {
		requires.push(resolveTsNode(opts));
	}

	if (depsFile) {
		const hook = resolveHook();

		if (hook) {
			requires.push(hook);
		}
	}

	return requires;
}

function resolveTsNode(opts: IOptions): string {
	const id = opts.transpileOnly ? "ts-node/register/transpile-only" : "ts-node/register";
	const paths = [opts.cwd, path.dirname(opts.entry), __dirname];

	try {
		return require.resolve(id, { paths });
	} catch (err) {
		return fail(`typescript models need ts-node, install it alongside your model:\n  yarn add --dev ts-node typescript`);
	}
}

/**
 * The dependency hook lives next to this file. When the cli itself is run from
 * source (ts-node src/cli.ts) the compiled hook does not exist yet, so fall
 * back to the typescript one.
 */
function resolveHook(): string {
	const compiled = path.join(__dirname, "deps-hook.js");

	if (isFile(compiled)) {
		return compiled;
	}

	const source = path.join(__dirname, "deps-hook.ts");

	if (isFile(source)) {
		return source;
	}

	return "";
}

function scadOutputFor(entry: string): string {
	return `${entry.replace(/\.tsx?$/i, "").replace(/\.jsx?$/i, "")}.scad`;
}

function describeOutput(entry: string, before: number): string {
	const output = scadOutputFor(entry);

	let stat: fs.Stats;

	try {
		stat = fs.statSync(output);
	} catch (err) {
		return "";
	}

	if (stat.mtimeMs <= before) {
		return "";
	}

	return `${path.relative(process.cwd(), output)} ${dim(`(${stat.size} bytes)`)}`;
}

function mtimeOf(target: string): number {
	try {
		return fs.statSync(target).mtimeMs;
	} catch (err) {
		return 0;
	}
}

class Runner {
	private opts: IOptions;

	private requires: string[];

	private depsFile: string;

	private child: ChildProcess | null = null;

	constructor(opts: IOptions, requires: string[], depsFile: string) {
		this.opts = opts;
		this.requires = requires;
		this.depsFile = depsFile;
	}

	public run(): Promise<IRunResult> {
		const started = Date.now();
		const outputBefore = mtimeOf(scadOutputFor(this.opts.entry));
		const args: string[] = [];

		this.requires.forEach((mod) => args.push("--require", mod));
		args.push(this.opts.entry, ...this.opts.scriptArgs);

		if (this.depsFile) {
			try {
				fs.rmSync(this.depsFile, { force: true });
			} catch (err) {
				// ignore, a stale list is still better than none
			}
		}

		if (!this.opts.quiet) {
			log(`${cyan("run")} ${path.relative(process.cwd(), this.opts.entry)}`);
		}

		const child = spawn(process.execPath, args, {
			cwd: this.opts.cwd,
			stdio: "inherit",
			env: { ...process.env, JS2SCAD_DEPS_OUT: this.depsFile }
		});

		this.child = child;

		return new Promise<IRunResult>((resolve) => {
			const finish = (code: number): void => {
				this.child = null;

				const durationMs = Date.now() - started;

				if (0 === code) {
					if (!this.opts.quiet) {
						const written = describeOutput(this.opts.entry, outputBefore);

						log(green("ok"), written || dim("no scad file written"), dim(`${durationMs}ms`));
					}
				} else {
					log(`${red("failed")} exit code ${code} ${dim(`${durationMs}ms`)}`);
				}

				resolve({ code, deps: this.readDeps(), durationMs });
			};

			child.on("error", (err) => {
				log(`${red("error")} ${err.message}`);
				finish(1);
			});

			child.on("exit", (code, signal) => {
				if (null !== signal) {
					// killed by the watcher for a rebuild
					this.child = null;
					resolve({ code: 0, deps: this.readDeps(), durationMs: Date.now() - started });
					return;
				}

				finish(null === code ? 1 : code);
			});
		});
	}

	public kill(): void {
		if (this.child) {
			this.child.kill("SIGTERM");
		}
	}

	private readDeps(): string[] {
		if (!this.depsFile) {
			return [];
		}

		try {
			const deps = JSON.parse(fs.readFileSync(this.depsFile, "utf8"));

			return Array.isArray(deps) ? deps.filter((dep) => "string" === typeof dep) : [];
		} catch (err) {
			return [];
		}
	}
}

/**
 * Watches a set of files by watching the directories that contain them, which
 * survives the write-to-temp-then-rename dance most editors do.
 */
class Watcher {
	private watchers = new Map<string, fs.FSWatcher>();

	private files = new Set<string>();

	private dirs = new Set<string>();

	private timer: NodeJS.Timeout | null = null;

	private onChange: (file: string) => void;

	constructor(onChange: (file: string) => void) {
		this.onChange = onChange;
	}

	public setFiles(files: string[]): void {
		this.files = new Set(files.map((file) => path.resolve(file)));

		const dirs = new Set<string>();

		this.files.forEach((file) => dirs.add(path.dirname(file)));

		this.dirs.forEach((dir) => {
			if (!dirs.has(dir)) {
				const watcher = this.watchers.get(dir);

				if (watcher) {
					watcher.close();
				}

				this.watchers.delete(dir);
			}
		});

		dirs.forEach((dir) => {
			if (this.watchers.has(dir)) {
				return;
			}

			try {
				const watcher = fs.watch(dir, (eventType, filename) => {
					if (!filename) {
						this.trigger(dir);
						return;
					}

					const changed = path.join(dir, filename.toString());

					if (this.files.has(changed)) {
						this.trigger(changed);
					}
				});

				watcher.on("error", () => {
					watcher.close();
					this.watchers.delete(dir);
				});

				this.watchers.set(dir, watcher);
			} catch (err) {
				log(`${red("error")} cannot watch ${dir}: ${(err as Error).message}`);
			}
		});

		this.dirs = dirs;
	}

	public close(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.watchers.forEach((watcher) => watcher.close());
		this.watchers.clear();
	}

	public count(): number {
		return this.files.size;
	}

	private trigger(file: string): void {
		if (this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(() => {
			this.timer = null;
			this.onChange(file);
		}, 75);
	}
}

async function watchMode(opts: IOptions, runner: Runner): Promise<void> {
	let running = false;
	let queued = false;

	const watcher = new Watcher((file) => {
		if (opts.clear) {
			process.stderr.write("\u001b[2J\u001b[3J\u001b[H");
		}

		log(`${dim("changed")} ${path.relative(process.cwd(), file)}`);

		if (running) {
			queued = true;
			runner.kill();
			return;
		}

		build().catch((err) => fail(err instanceof Error ? err.message : String(err)));
	});

	const build = async (): Promise<void> => {
		running = true;

		do {
			queued = false;

			// eslint-disable-next-line no-await-in-loop
			const result = await runner.run();

			// a run we killed for a rebuild never reports its dependencies, in
			// that case keep watching whatever the last complete run found
			if (result.deps.length) {
				watcher.setFiles(result.deps);
			} else if (!watcher.count()) {
				watcher.setFiles([opts.entry]);
			}
		} while (queued);

		running = false;

		log(dim(`watching ${watcher.count()} file(s), press ctrl-c to stop`));
	};

	const stop = (): void => {
		runner.kill();
		watcher.close();
		process.exit(0);
	};

	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);

	await build();
}

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));

	if (!isDirectory(opts.cwd)) {
		fail(`cwd ${opts.cwd} is not a directory`);
	}

	let tempDir = "";
	let depsFile = "";

	if (opts.watch) {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "js2scad-"));
		depsFile = path.join(tempDir, "deps.json");

		process.on("exit", () => {
			try {
				fs.rmSync(tempDir, { recursive: true, force: true });
			} catch (err) {
				// nothing useful to do while exiting
			}
		});
	}

	const runner = new Runner(opts, buildRequires(opts, depsFile), depsFile);

	if (opts.watch) {
		await watchMode(opts, runner);
		return;
	}

	const result = await runner.run();

	process.exit(result.code);
}

main().catch((err) => {
	fail(err instanceof Error ? err.message : String(err));
});
