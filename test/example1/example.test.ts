/* eslint-env node,jest */

import Scad from "../../src/index";

describe("Example1", () => {
	it("should produce correct opescad content", () => {
		const scad = new Scad.Module({});

		const origin = scad.modules.translate([0, 0, 0]);

		scad.specials.$fn = 200;
		// scad.specials.$vpr = [0, 0, 0];

		// TODO how can we maintain the order of the variables?

		const default_fn = scad.addVariable("default_fn", 200);

		const sphere_diameter = scad.addVariable("sphere_diameter", 5, {
			section: "Options",
			comment: "Diameter of the sphere"
		});
		const cube1 = scad.addVariable<Scad.IVector3>("cube1", [1, 2, 3], {
			section: "Options",
			comment: "Dimensions of first cube"
		});
		const cube2 = scad.addVariable<Scad.IVector3>("cube2", [5, 5, 5], {
			section: "Options",
			comment: "Dimensions of second cube"
		});

		// const sphere = origin(scad.modules.sphere({ r: 5, $fn: 200 }));
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
		scad.add(
			scad.modules.translate([0, -60, 0])(
				scad.modules.linear_extrude(5)(scad.modules.text({ text: "Hello World", size: 5, font: "Courier New" }))
			)
		);

		scad.add(
			scad.modules.translate([75, 100, 0])(
				scad.modules.linear_extrude({ height: 60, twist: 90, slices: 60 })(
					scad.modules.difference()(
						scad.modules.offset({ r: 10 })(scad.modules.square(5, { center: true })),
						scad.modules.offset({ r: 8 })(scad.modules.square(5, { center: true }))
					)
				)
			)
		);

		scad.add(
			scad.modules.translate([0, 100, 0])(
				scad.modules.rotate([90, 180, 90])(
					scad.modules.linear_extrude(50)(
						scad.modules.polygon({
							points: [
								//x,y
								/*
									   O  .
							*/
								[-2.8, 0],
								/*
									 O__X  .
							*/
								[-7.8, 0],
								/*
								   O
									\
									 X__X  .
							*/
								[-15.3633, 10.3],
								/*
								   X_______._____O
									\
									 X__X  .
							*/
								[15.3633, 10.3],
								/*
								   X_______._______X
									\             /
									 X__X  .     O
							*/
								[7.8, 0],
								/*
								   X_______._______X
									\             /
									 X__X  .  O__X
							*/
								[2.8, 0],
								/*
								X__________.__________X
								 \                   /
								  \              O  /
								   \            /  /
									\          /  /
									 X__X  .  X__X
							*/
								[5.48858, 5.3],
								/*
								X__________.__________X
								 \                   /
								  \   O__________X  /
								   \            /  /
									\          /  /
									 X__X  .  X__X
							*/
								[-5.48858, 5.3]
							]
						})
					)
				)
			)
		);

		const items: Scad.Node[] = [];
		for (let i = 0; i < 36; i++) {
			for (let j = 0; j < 36; j++) {
				items.push(
					scad.any.color([
						0.5 + Math.sin(10 * i) / 2,
						0.5 + Math.sin(10 * j) / 2,
						0.5 + Math.sin(10 * (i + j)) / 2
					])(
						scad.modules.translate([i, j, 0])(
							scad.modules.cube({ size: [1, 1, 11 + 10 * Math.cos(10 * i) * Math.sin(10 * j)] })
						)
					)
				);
			}
		}

		scad.add(scad.modules.translate([-100, 100, 0])(...items));

		scad.add(
			scad.modules.translate([60, 0, 0])(
				scad.modules.linear_extrude(50)(scad.modules.square({ size: 10, center: false }))
			)
		);
		scad.add(
			scad.modules.translate([80, 0, 0])(
				scad.modules.linear_extrude(50)(scad.modules.square({ size: 10, center: true }))
			)
		);

		expect(scad.toString()).toMatchSnapshot();
	});
});
