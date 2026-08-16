#!/usr/bin/env node
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
export {};
//# sourceMappingURL=cli.d.ts.map