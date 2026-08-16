/**
 * Child process hook used by the js2scad cli when running in watch mode.
 *
 * It is loaded with `node --require` before the model itself, and on exit it
 * dumps every non `node_modules` file that ended up in the require cache. That
 * gives the watcher the real dependency list of the model (the entry file plus
 * any local helper it imported) instead of guessing.
 */
export {};
//# sourceMappingURL=deps-hook.d.ts.map