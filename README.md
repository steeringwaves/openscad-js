# openscad-js

![workflow](https://github.com/steeringwaves/openscad-js/actions/workflows/test.yml/badge.svg)

Javascript/typescript based code generator for openscad.

## usage

```ts
import fs from "fs";
import Scad from "@steeringwaves/openscad-js";

const scad = new Scad.Module({
	fs: fs // Only required when calling toScadFile()
});

const origin = scad.modules.translate([0, 0, 0]);

scad.specials.$fn = 200;
scad.specials.$vpr = [0, 0, 0];

const default_fn = scad.addVariable("default_fn", 200);

const sphere_diameter = scad.addVariable("sphere_diameter", 5, { section: "Options", comment: "Diameter of the sphere" });
const cube1 = scad.addVariable<Scad.IVector3>("cube1", [1, 2, 3], {
	section: "Options",
	comment: "Dimensions of first cube"
});
const cube2 = scad.addVariable<Scad.IVector3>("cube2", [5, 5, 5], {
	section: "Options",
	comment: "Dimensions of second cube"
});

const sphere = origin(scad.modules.sphere({ r: sphere_diameter, $fn: 200 }));

scad.add(sphere);
scad.add(scad.modules.translate([10, 0, 0])(sphere));
scad.add(scad.modules.translate([-10, 0, 0])(scad.modules.sphere({ r: 5, $fn: 8 })));
scad.add(scad.modules.translate([20, 0, 0])(scad.modules.cube(cube1)));
scad.add(scad.modules.translate([20, 10, 0])(scad.modules.cube(cube2)));
scad.add(scad.modules.translate([20, 40, 0])(scad.modules.resize(cube2)(scad.modules.cube(cube1))));
scad.add(scad.modules.translate([20, -10, 0])(scad.modules.cube(5)));
scad.add(scad.modules.translate([40, 0, 0])(scad.modules.cylinder({ r1: 3, r2: 5, h: 25, center: true })));
scad.add(scad.modules.translate([40, 20, 0])(scad.modules.cylinder({ r: 5, h: 25 })));

console.log(scad.toString());

scad.toScadFile(__filename);
```

```js
const Scad = require("@steeringwaves/openscad-js");

const scad = new Scad.Module({});

const origin = scad.modules.translate([0, 0, 0]);

scad.specials.$fn = 200;
scad.specials.$vpr = [0, 0, 0];

const sphere_diameter = scad.addVariable("sphere_diameter", 5, { section: "Options", comment: "Diameter of the sphere" });
const sphere = origin(scad.modules.sphere({ r: sphere_diameter }));

scad.add(sphere);

console.log(scad.toString());
```

## dev

```sh
npm install

# bundle with esbuild
npm run build

# run
npm run bin

# type help to see a list of available commands
```

```txt
Available functions:
  TODO
```
