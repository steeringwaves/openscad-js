/**
 * Child process hook used by the js2scad cli when running in watch mode.
 *
 * It is loaded with `node --require` before the model itself, and on exit it
 * dumps every non `node_modules` file that ended up in the require cache. That
 * gives the watcher the real dependency list of the model (the entry file plus
 * any local helper it imported) instead of guessing.
 */

import fs from "fs";
import path from "path";

const depsFile = process.env.JS2SCAD_DEPS_OUT;

if (depsFile) {
	process.on("exit", () => {
		try {
			const files = Object.keys(require.cache).filter((file) => {
				if (!file || file === __filename) {
					return false;
				}

				return !file.split(path.sep).includes("node_modules");
			});

			fs.writeFileSync(depsFile, JSON.stringify(files));
		} catch (err) {
			// never let dependency tracking break the model run
		}
	});
}

export {};
