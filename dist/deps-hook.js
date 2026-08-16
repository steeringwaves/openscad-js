"use strict";
/**
 * Child process hook used by the js2scad cli when running in watch mode.
 *
 * It is loaded with `node --require` before the model itself, and on exit it
 * dumps every non `node_modules` file that ended up in the require cache. That
 * gives the watcher the real dependency list of the model (the entry file plus
 * any local helper it imported) instead of guessing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const depsFile = process.env.JS2SCAD_DEPS_OUT;
if (depsFile) {
    process.on("exit", () => {
        try {
            const files = Object.keys(require.cache).filter((file) => {
                if (!file || file === __filename) {
                    return false;
                }
                return !file.split(path_1.default.sep).includes("node_modules");
            });
            fs_1.default.writeFileSync(depsFile, JSON.stringify(files));
        }
        catch (err) {
            // never let dependency tracking break the model run
        }
    });
}
//# sourceMappingURL=deps-hook.js.map