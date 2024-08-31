/* eslint-disable max-classes-per-file */
interface IFileSystem {
	writeFileSync(file: string, data: string): void;
}

function entriesWithout<T>(obj: T, list: string[]): [string, T[keyof T]][] {
	return Object.entries(obj as any).filter(([k, v]) => v !== undefined && !list.includes(k)) as [string, T[keyof T]][];
}

const blacklistNames = ["parent", "indent", "fs", "banner", "opts"];

/* eslint-disable max-classes-per-file */
interface IFileSystem {
	writeFileSync(file: string, data: string): void;
}

namespace Scad {
	export type IVariable<T> = Variable<T> | T;

	export interface IVariableProps {
		name: string;
		args: any[];
	}

	export interface IModuleProps {
		name: string;
		args: any[];
		children: Scad.Node[];
	}

	export interface IModifierProps {
		symbol: string;
		child: Scad.Node;
	}

	export interface IObjectProps {
		name: string;
		args: any[];
	}

	export class Node {
		type: string;

		props: IVariableProps | IModuleProps | IModifierProps | IObjectProps;

		constructor(type: string, props: IVariableProps | IModuleProps | IModifierProps | IObjectProps) {
			this.type = type;
			this.props = props;
		}
	}

	// TODO how can we pass UserVariables to other modules and validate type of variable is correct?
	export interface IVariableOpts {
		section?: string;
		comment?: string;
	}

	export class Variable<T> {
		public parent: Module;

		public name: string;

		public value: T;

		public opts?: IVariableOpts;

		constructor(parent: Module, name: string, value: T, opts?: IVariableOpts) {
			this.parent = parent;
			this.name = name;
			this.value = value;
			this.opts = opts;
		}

		toString(): string {
			let comment = "";

			if (this.opts && this.opts.comment) {
				comment += `// ${this.opts.comment}\n`;
			}

			return `${comment}${this.parent.writeVariable(0, this.name, [this.value])}\n`;
		}
	}

	export class Specials {
		public parent: Module;

		public $fa: number | undefined; // minimum angle

		public $fs: number | undefined; // minimum size

		public $fn: number | undefined; // minimum number of fragments

		public $t: number | undefined; // animations step

		public $vpr: Scad.IVector3 | Scad.IVector2 | undefined; // viewport rotation angles in degrees

		public $vpt: Scad.IVector3 | Scad.IVector2 | undefined; // viewport translation

		public $vpd: number | undefined; // viewport camera distance

		public $vpf: number | undefined; // viewport camera field of view

		public $children: number | undefined; // number of module children

		public $preview: boolean | undefined; // true in F5 preview, false for F6

		constructor(parent: Module) {
			this.parent = parent;
		}

		toString(): string {
			const entries = entriesWithout(this, ["parent"]);

			if (0 === entries.length) {
				return "";
			}

			return `/* Specials */\n\n${entries.map(([k, v]) => this.parent.writeVariable(0, k, [v])).join("\n")}\n`;
		}
	}

	export interface IModuleOptions {
		fs?: IFileSystem;
		indent?: string;
		banner?: string;
	}

	export class Module {
		public any: any;

		public modules: Modules;

		public specials: Specials;

		private entries: Scad.Node[] = [];

		private variables: Scad.Variable<any>[] = [];

		public indent = "\t";

		public banner = `/* AUTOGENERATED FILE USING @steeringwaves/openscad-js DO NOT MODIFY */\n`;

		public fs: IFileSystem | undefined;

		constructor(opts: IModuleOptions = {}) {
			const proxyModules = new Proxy(
				{
					_bg: this.defineModifier("%"),
					_debug: this.defineModifier("#"),
					_root: this.defineModifier("!"),
					_disable: this.defineModifier("*")
				},
				{
					get: (obj, prop) => {
						if (prop in obj) {
							return (obj as any)[prop];
						}

						return this.defineModule(prop as string);
					}
				}
			);

			this.any = proxyModules as any;

			this.modules = (<any>proxyModules) as Modules;

			this.specials = new Specials(this);

			if (undefined !== opts.fs) {
				this.fs = opts.fs;
			}

			if (undefined !== opts.indent) {
				this.indent = opts.indent;
			}

			if (undefined !== opts.banner) {
				this.banner = opts.banner;
			}
		}

		public addVariable<T>(name: string, value: T, opts?: IVariableOpts): Scad.Variable<T> {
			const v = new Variable<T>(this, name, value, opts);
			this.variables.push(v);
			return v;
		}

		public add(node: Scad.Node): Scad.Node {
			this.entries.push(node);
			return node;
		}

		public addMultiple(nodes: Scad.Node[]): Scad.Node[] {
			this.entries.push(...nodes);
			return nodes;
		}

		public toString(): string {
			let variableText = "";
			const sections: Record<string, Scad.Variable<any>[]> = {};
			const noSections: Scad.Variable<any>[] = [];

			for (let i = 0; i < this.variables.length; i++) {
				const v = this.variables[i];
				if (v.opts && v.opts.section) {
					if (!sections[v.opts.section]) {
						sections[v.opts.section] = [];
					}
					sections[v.opts.section].push(v);
				} else {
					noSections.push(v);
				}
			}

			if (noSections.length > 0) {
				variableText += `/* Variables */\n\n`;
				variableText += noSections.map((v) => v.toString()).join("\n");
				variableText += `\n`;
			}

			// get list of sections alphabetically
			const sectionNames = Object.keys(sections).sort();

			// loop through all sections
			if (sectionNames.length > 0) {
				for (let i = 0; i < sectionNames.length; i++) {
					const sectionName = sectionNames[i];
					const section = sections[sectionName];
					variableText += `/* [ ${sectionName} ] */\n\n`;
					variableText += section.map((v) => v.toString()).join("\n");
				}
				variableText += `\n`;
			}

			return `${this.banner}\n${this.specials.toString()}\n${variableText}\n${this.compile(this.entries)}`;
		}

		public toFile(filename: string, verbose?: boolean): void {
			if (!this.fs) {
				throw new Error("no filesystem module provided");
			}

			const scadSrc = this.toString();

			if (verbose) {
				console.log(scadSrc);
			}
			this.fs.writeFileSync(filename, scadSrc);
		}

		public toScadFile(src: string, verbose?: boolean): void {
			this.toFile(sourceFilenameToScadFilename(src), verbose);
		}

		public writeNode(depth: number, node: Scad.Node): string {
			if ("module" === node.type) {
				const props = <Scad.IModuleProps>node.props;
				return this.writeModule(depth, props.name, props.args, props.children);
			}

			if ("object" === node.type) {
				const props = <Scad.IObjectProps>node.props;
				return this.writeObject(depth, props.name, props.args);
			}

			if ("modifier" === node.type) {
				const props = <Scad.IModifierProps>node.props;
				return this.writeModifier(depth, props.symbol, props.child);
			}

			if ("variable" === node.type) {
				const props = <Scad.IVariableProps>node.props;
				return this.writeVariable(depth, props.name, props.args);
			}

			throw new Error(`unexpected node ${node}`);
		}

		public writeIndent(depth: number): string {
			return this.indent.repeat(depth);
		}

		public writeModule(depth: number, name: string, args: any[], children: Scad.Node[]): string {
			const childrentText = `${children
				.map((c) => this.writeIndent(depth + 1) + this.writeNode(depth + 1, c))
				.join("\n")}`;

			return `${name}(${this.writeArgs(args)}) {\n${childrentText}\n${this.writeIndent(depth)}}`;
		}

		public writeObject(depth: number, name: string, args: any[]): string {
			return `${name}(${this.writeArgs(args)});`;
		}

		public writeVariable(depth: number, name: string, args: any[]): string {
			return `${name} = ${this.writeArgs(args)};`;
		}

		public writeArgs(args: any[]): string {
			return args
				.filter(
					(arg) =>
						"number" === typeof arg ||
						"boolean" === typeof arg ||
						"string" === typeof arg ||
						Array.isArray(arg) ||
						entriesWithout(arg, blacklistNames).length > 0
				)
				.map((arg) => this.writeValue(arg, true))
				.join(", ");
		}

		public writeValue(value: any, isArg = false): string {
			if (value instanceof Scad.Variable) {
				return value.name;
			}
			if ("number" === typeof value || "boolean" === typeof value) {
				return String(value);
			}
			if ("string" === typeof value) {
				return `"${value.replace(/"/g, '"')}"`;
			}
			if (Array.isArray(value)) {
				return `[${value.map((v) => this.writeValue(v)).join(", ")}]`;
			}
			if (isArg) {
				return entriesWithout(value, blacklistNames)
					.map(([k, v]) => `${k}=${this.writeValue(v)}`)
					.join(", ");
			}
			throw new Error(`unexpected value ${value}`);
		}

		public writeModifier(depth: number, symbol: string, child: Scad.Node): string {
			return symbol + this.writeNode(depth, child);
		}

		public compile(node: Scad.Node | Scad.Node[]): string {
			if (Array.isArray(node)) {
				return node.map((n) => this.writeNode(0, n)).join("\n");
			}
			return this.writeNode(0, node);
		}

		public defineModule(name: string) {
			return (...args: any[]) => {
				const result = function scadModule(...children: Scad.Node[]) {
					return { type: "module", props: <Scad.IModuleProps>{ name, args, children } };
				};
				Object.assign(result, { type: "object", props: <Scad.IObjectProps>{ name, args } });
				return result;
			};
		}

		public defineModifier(symbol: string) {
			return (child: Scad.Node) => ({ type: "modifier", props: <Scad.IModifierProps>{ symbol, child } });
		}
	}

	// Define an interface for an XY vector that is a number array of length 2
	export interface IVector2 extends Array<number> {
		0: number;
		1: number;
	}

	// Define an interface for an XYZ vector that is a number array of length 3
	export interface IVector3 extends Array<number> {
		0: number;
		1: number;
		2: number;
	}

	// Define an interface for an XYZ vector that is a boolean array of length 3
	export interface IVector3Boolean extends Array<boolean> {
		0: boolean;
		1: boolean;
		2: boolean;
	}

	// Define an interface for an array of XYZ vectors
	export interface IVector3Array extends Array<IVector3> {}

	// Define an interface for an array of XY vectors
	export interface IVector2Array extends Array<IVector2> {}

	// All source comes from https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/

	// interface ISpecialVariables {
	// 	$fa?: number; // minimum angle
	// 	$fs?: number; // minimum size
	// 	$fn?: number; // minimum number of fragments
	// 	$t?: number; // animations step
	// 	$vpr?: number[]; // viewport rotation angles in degrees
	// 	$vpt?: number[]; // viewport translation
	// 	$vpd?: number; // viewport camera distance
	// 	$vpf?: number; // viewport camera field of view
	// 	$children?: number; // number of module children
	// 	$preview?: boolean; // true in F5 preview, false for F6
	// }

	// interface ISpecialVariables {
	// 	$fa: (val: number) => Scad.Node; // minimum angle
	// 	$fs: (val: number) => Scad.Node; // minimum size
	// 	$fn: (val: number) => Scad.Node; // minimum number of fragments
	// 	$t: (val: number) => Scad.Node; // animations step
	// 	$vpr: (val: number[]) => Scad.Node; // viewport rotation angles in degrees
	// 	$vpt: (val: number[]) => Scad.Node; // viewport translation
	// 	$vpd: (val: number) => Scad.Node; // viewport camera distance
	// 	$vpf: (val: number) => Scad.Node; // viewport camera field of view
	// 	$children: (val: number) => Scad.Node; // number of module children
	// 	$preview: (val: boolean) => Scad.Node; // true in F5 preview, false for F6
	// }

	// translate
	// Translates (moves) its child elements along the specified vector. The argument name is optional.
	interface ITranslateOpts {
		v?: IVariable<Scad.IVector3>; // The vector to translate the child element by.
	}

	// scale
	// Scales its child elements using the specified vector. The argument name is optional.
	interface IScaleOpts {
		v?: IVariable<Scad.IVector3>; // The vector to scale the child element by.
	}

	// resize
	// Modifies the size of the child object to match the given x,y, and z.
	interface IResizeOpts {
		newsize?: IVariable<Scad.IVector3>; // The vector to scale the child element by.
		auto?: IVariable<boolean> | IVariable<Scad.IVector3Boolean>; // If true, the child object is scaled proportionally in all dimensions. If false, the child object is scaled to the exact size specified by newsize.
	}

	// mirror
	// Transforms the child element to a mirror of the original, as if it were the mirror image seen through a plane intersecting the origin. The argument to mirror() is the normal vector of the origin-intersecting mirror plane used, meaning the vector coming perpendicularly out of the plane. Each coordinate of the original object is altered such that it becomes equidistant on the other side of this plane from the closest point on the plane. For example, mirror([1,0,0]), corresponding to a normal vector pointing in the x-axis direction, produces an object such that all positive x coordinates become negative x coordinates, and all negative x coordinates become positive x coordinates.
	interface IMirrorOpts {
		v?: IVariable<Scad.IVector3>; // The vector to mirror the child element by.
	}

	// multimatrix
	// Multiplies the geometry of all child elements with the given affine transformation matrix, where the matrix is 4×3 - a vector of 3 row vectors with 4 elements each, or a 4×4 matrix with the 4th row always forced to [0,0,0,1].
	interface IMultmatrixOpts {
		m?: IVariable<Scad.IVector3Array>; // The vector to mirror the child element by.
	}

	// offset
	// Offset generates a new 2d interior or exterior outline from an existing outline. There are two modes of operation. radial and offset. The offset method creates a new outline whose sides are a fixed distance outer (delta > 0) or inner (delta < 0) from the original outline. The radial method creates a new outline as if a circle of some radius is rotated around the exterior (r>0) or interior (r<0) original outline.
	// Parameters
	// r
	//  Double. Amount to offset the polygon. When negative, the polygon is offset inward. R specifies the radius of the circle that is rotated about the outline, either inside or outside. This mode produces rounded corners.
	// delta
	//  Double. Amount to offset the polygon. Delta specifies the distance of the new outline from the original outline, and therefore reproduces angled corners. When negative, the polygon is offset inward. No inward perimeter is generated in places where the perimeter would cross itself.
	// chamfer
	//  Boolean. (default false) When using the delta parameter, this flag defines if edges should be chamfered (cut off with a straight line) or not (extended to their intersection).
	interface IOffsetOpts {
		r?: IVariable<number>; // Double. Amount to offset the polygon. When negative, the polygon is offset inward. R specifies the radius of the circle that is rotated about the outline, either inside or outside. This mode produces rounded corners.
		delta?: IVariable<number>; // Double. Amount to offset the polygon. Delta specifies the distance of the new outline from the original outline, and therefore reproduces angled corners. When negative, the polygon is offset inward. No inward perimeter is generated in places where the perimeter would cross itself.
		chamfer?: IVariable<boolean>; // Boolean. (default false) When using the delta parameter, this flag defines if edges should be chamfered (cut off with a straight line) or not (extended to their intersection).
	}

	// TODO: minkowski

	// TODO: hull

	// rotate
	// Rotates its child 'a' degrees about the axis of the coordinate system or around an arbitrary axis. The argument names are optional if the arguments are given in the same order as specified.
	// Parameters
	// a
	//  The 'a' argument (deg_a) can be an array, as expressed in the later usage above; when deg_a is an array, the 'v' argument is ignored. Where 'a' specifies multiple axes then the rotation is applied in the following order: x then y then z.
	// v
	//  The optional argument 'v' is a vector and allows you to set an arbitrary axis about which the object is rotated.
	interface IRotateOpts {
		a?: IVariable<number> | IVariable<Scad.IVector3>; // The 'a' argument (deg_a) can be an array, as expressed in the later usage above; when deg_a is an array, the 'v' argument is ignored. Where 'a' specifies multiple axes then the rotation is applied in the following order: x then y then z.
		v?: IVariable<Scad.IVector3>; // The optional argument 'v' is a vector and allows you to set an arbitrary axis about which the object is rotated.
	}

	// cube
	// Creates a cube in the first octant. When center is true, the cube is centered on the origin. Argument names are optional if given in the order shown here.
	interface ICubeOpts {
		size?: IVariable<Scad.IVector3> | IVariable<number>; // single value, cube with all sides this length, 3 value array [x,y,z], cube with dimensions x, y and z.
		center?: IVariable<boolean>; // false (default), 1st (positive) octant, one corner at (0,0,0), true, cube is centered at (0,0,0)
	}

	// sphere
	// Creates a sphere at the origin of the coordinate system. The r argument name is optional. To use d instead of r, d must be named.
	interface ISphereOpts {
		d?: IVariable<number>; // Diameter. This is the diameter of the sphere.
		r?: IVariable<number>; // Radius. This is the radius of the sphere. The resolution of the sphere is based on the size of the sphere and the $fa, $fs and $fn variables. For more information on these special variables look at: OpenSCAD_User_Manual/Other_Language_Features
		$fa?: IVariable<number>; // Fragment angle in degrees
		$fs?: IVariable<number>; // Fragment size in mm
		$fn?: IVariable<number>; // Resolution
	}

	// cylinder
	// Creates a cylinder or cone centered about the z axis. When center is true, it is also centered vertically along the z axis.
	// Parameters
	// h : height of the cylinder or cone
	// r  : radius of cylinder. r1 = r2 = r.
	// r1 : radius, bottom of cone.
	// r2 : radius, top of cone.
	// d  : diameter of cylinder. r1 = r2 = d / 2. [Note: Requires version 2014.03]
	// d1 : diameter, bottom of cone. r1 = d1 / 2. [Note: Requires version 2014.03]
	// d2 : diameter, top of cone. r2 = d2 / 2. [Note: Requires version 2014.03]
	// center
	// 	false (default), z ranges from 0 to h
	// 	true, z ranges from -h/2 to +h/2
	// $fa : minimum angle (in degrees) of each fragment.
	// $fs : minimum circumferential length of each fragment.
	// $fn : fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs
	// 	$fa, $fs and $fn must be named parameters. click here for more details,.
	interface ICylinderOpts {
		h?: IVariable<number>; // height of the cylinder or cone
		r?: IVariable<number>; // radius of cylinder. r1 = r2 = r.
		r1?: IVariable<number>; // radius, bottom of cone.
		r2?: IVariable<number>; // radius, top of cone.
		d?: IVariable<number>; // diameter of cylinder. r1 = r2 = d / 2. [Note: Requires version 2014.03]
		d1?: IVariable<number>; // diameter, bottom of cone. r1 = d1 / 2. [Note: Requires version 2014.03]
		d2?: IVariable<number>; // diameter, top of cone. r2 = d2 / 2. [Note: Requires version 2014.03]
		center?: IVariable<boolean>; // false (default), z ranges from 0 to h, true, z ranges from -h/2 to +h/2
		$fa?: IVariable<number>; // minimum angle (in degrees) of each fragment.
		$fs?: IVariable<number>; // minimum circumferential length of each fragment.
		$fn?: IVariable<number>; // fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs
	}

	// polyhedron
	// A polyhedron is the most general 3D primitive solid. It can be used to create any regular or irregular shape including those with concave as well as convex features. Curved surfaces are approximated by a series of flat surfaces.
	// Parameters
	// points
	// 	Vector of 3d points or vertices. Each point is in turn a vector, [x,y,z], of its coordinates.
	// 	Points may be defined in any order. N points are referenced, in the order defined, as 0 to N-1.
	// triangles [Deprecated: triangles will be removed in future releases. Use faces parameter instead]
	// 	Vector of faces that collectively enclose the solid. Each face is a vector containing the indices (0 based) of 3 points from the points vector.
	// faces [Note: Requires version 2014.03]
	// 	Vector of faces that collectively enclose the solid. Each face is a vector containing the indices (0 based) of 3 or more points from the points vector.
	// 	Faces may be defined in any order. Define enough faces to fully enclose the solid, with no overlap.
	// 	If points that describe a single face are not on the same plane, the face is automatically split into triangles as needed.
	// convexity
	// 	Integer. The convexity parameter specifies the maximum number of faces a ray intersecting the object might penetrate. This parameter is needed only for correct display of the object in OpenCSG preview mode. It has no effect on the polyhedron rendering. For display problems, setting it to 10 should work fine for most cases.
	interface IPolyhedronOpts {
		points: IVariable<Scad.IVector3Array>; // Vector of 3d points or vertices. Each point is in turn a vector, [x,y,z], of its coordinates.
		triangles?: IVariable<Scad.IVector3Array>; // Vector of faces that collectively enclose the solid. Each face is a vector containing the indices (0 based) of 3 points from the points vector.
		faces?: IVariable<Scad.IVector3Array>; // Vector of faces that collectively enclose the solid. Each face is a vector containing the indices (0 based) of 3 or more points from the points vector.
		convexity?: IVariable<number>; // Integer. The convexity parameter specifies the maximum number of faces a ray intersecting the object might penetrate. This parameter is needed only for correct display of the object in OpenCSG preview mode. It has no effect on the polyhedron rendering. For display problems, setting it to 10 should work fine for most cases.
	}

	// linear_extrude
	// Linear Extrusion is an operation that takes a 2D object as input and generates a 3D object as a result.
	// Parameters
	// height
	//  must be positive.
	// twist
	//  Twist is the number of degrees of through which the shape is extruded. Setting the parameter twist = 360 extrudes through one revolution. The twist direction follows the left hand rule.
	// center
	//  It is similar to the parameter center of cylinders. If center is false the linear extrusion Z range is from 0 to height; if it is true, the range is from -height/2 to height/2.
	// slices
	//  The slices parameter defines the number of intermediate points along the Z axis of the extrusion. Its default increases with the value of twist. Explicitly setting slices may improve the output refinement. Additional the segments parameter adds vertices (points) to the extruded polygon resulting in smoother twisted geometries. Segments need to be a multiple of the polygon's fragments to have an effect (6 or 9.. for a circle($fn=3), 8,12.. for a square() ).
	// scale
	//  Scales the 2D shape by this value over the height of the extrusion. Scale can be a scalar or a vector:
	// $fn
	//  is optional and specifies the resolution of the linear_extrude(higher number brings more "smoothness", but more computation time is needed).
	interface ILinearExtrudeOpts {
		height: IVariable<number>; // must be positive.
		twist?: IVariable<number>; // Twist is the number of degrees of through which the shape is extruded. Setting the parameter twist = 360 extrudes through one revolution. The twist direction follows the left hand rule.
		center?: IVariable<boolean>; // It is similar to the parameter center of cylinders. If center is false the linear extrusion Z range is from 0 to height; if it is true, the range is from -height/2 to height/2.
		slices?: IVariable<number>; // The slices parameter defines the number of intermediate points along the Z axis of the extrusion. Its default increases with the value of twist. Explicitly setting slices may improve the output refinement. Additional the segments parameter adds vertices (points) to the extruded polygon resulting in smoother twisted geometries. Segments need to be a multiple of the polygon's fragments to have an effect (6 or 9.. for a circle($fn=3), 8,12.. for a square() ).
		scale?: IVariable<number> | IVariable<Scad.IVector3>; // Scales the 2D shape by this value over the height of the extrusion. Scale can be a scalar or a vector:
		$fn?: IVariable<number>; // is optional and specifies the resolution of the linear_extrude(higher number brings more "smoothness", but more computation time is needed).
	}

	// rotate_extrude
	// Rotational extrusion spins a 2D shape around the Z-axis to form a solid which has rotational symmetry. One way to think of this operation is to imagine a Potter's wheel placed on the X-Y plane with its axis of rotation pointing up towards +Z. Then place the to-be-made object on this virtual Potter's wheel (possibly extending down below the X-Y plane towards -Z). The to-be-made object is the cross-section of the object on the X-Y plane (keeping only the right half, X >= 0). That is the 2D shape that will be fed to rotate_extrude() as the child in order to generate this solid. Note that the object started on the X-Y plane but is tilted up (rotated +90 degrees about the X-axis) to extrude.
	// Parameters
	// convexity
	//  If the extrusion fails for a non - trival 2D shape, try setting the convexity parameter(the default is not 10, but 10 is a "good" value to try). See explanation further down.
	// angle
	//   [Note: Requires version 2019.05] : Defaults to 360. Specifies the number of degrees to sweep, starting at the positive X axis.The direction of the sweep follows the Right Hand Rule, hence a negative angle sweeps clockwise.
	// $fa
	//  minimum angle (in degrees) of each fragment.
	// $fs
	//  minimum circumferential length of each fragment.
	// $fn
	//  fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs
	interface IRotateExtrudeOpts {
		convexity?: IVariable<number>; // If the extrusion fails for a non - trival 2D shape, try setting the convexity parameter(the default is not 10, but 10 is a "good" value to try). See explanation further down.
		angle?: IVariable<number>; // [Note: Requires version 2019.05] : Defaults to 360. Specifies the number of degrees to sweep, starting at the positive X axis.The direction of the sweep follows the Right Hand Rule, hence a negative angle sweeps clockwise.
		$fa?: IVariable<number>; // minimum angle (in degrees) of each fragment.
		$fs?: IVariable<number>; // minimum circumferential length of each fragment.
		$fn?: IVariable<number>; // fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs
	}

	// 2d

	// square
	// Creates a square or rectangle in the first quadrant. When center is true the square is centered on the origin. Argument names are optional if given in the order shown here.
	// Parameters
	// size
	//  single value, square with both sides this length, 2 value array [x,y], rectangle with dimensions x and y
	// center
	//  false (default), 1st (positive) quadrant, one corner at (0,0), true, square is centered at (0,0)
	interface ISquareOpts {
		size?: IVariable<Scad.IVector2> | IVariable<number>; // single value, square with both sides this length, 2 value array [x,y], rectangle with dimensions x and y
		center?: IVariable<boolean>; // false (default), 1st (positive) quadrant, one corner at (0,0), true, square is centered at (0,0)
	}

	// circle
	// Creates a circle at the origin. All parameters, except r, must be named.
	// For a small, high resolution circle you can make a large circle, then scale it down, or you could set $fn or other special variables.Note: These examples exceed the resolution of a 3d printer as well as of the display screen.
	// Parameters
	// r
	//  circle radius.r name is the only one optional with circle. circle resolution is based on size, using $fa or $fs.
	// d
	//  circle diameter (only available in versions later than 2014.03).
	// $fa
	//  minimum angle (in degrees) of each fragment.
	// $fs
	//  minimum circumferential length of each fragment.
	// $fn
	//  fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs.
	interface ICircleOpts {
		r?: IVariable<number>; // circle radius.r name is the only one optional with circle. circle resolution is based on size, using $fa or $fs.
		d?: IVariable<number>; // circle diameter (only available in versions later than 2014.03).
		$fa?: IVariable<number>; // minimum angle (in degrees) of each fragment.
		$fs?: IVariable<number>; // minimum circumferential length of each fragment.
		$fn?: IVariable<number>; // fixed number of fragments in 360 degrees. Values of 3 or more override $fa and $fs.
	}

	// polygon
	// The function polygon() creates a multiple sided shape from a list of x,y coordinates. A polygon is the most powerful 2D object. It can create anything that circle and squares can, as well as much more. This includes irregular shapes with both concave and convex edges. In addition it can place holes within that shape.
	// Parameters
	// points
	//  The list of x,y points of the polygon. : A vector of 2 element vectors. Note: points are indexed from 0 to n-1.
	// paths
	// default
	// 	If no path is specified, all points are used in the order listed.
	// single vector
	// 	The order to traverse the points. Uses indices from 0 to n-1. May be in a different order and use all or part, of the points listed.
	// multiple vectors
	// 	Creates primary and secondary shapes. Secondary shapes are subtracted from the primary shape (like difference()). Secondary shapes may be wholly or partially within the primary shape.
	// A closed shape is created by returning from the last point specified to the first.
	// convexity
	//  Integer number of "inward" curves, ie. expected path crossings of an arbitrary line through the polygon. See below.
	interface IPolygonOpts {
		points: IVariable<Scad.IVector2Array>; // The list of x,y points of the polygon. : A vector of 2 element vectors. Note: points are indexed from 0 to n-1.
		paths?: IVariable<Scad.IVector2Array> | IVariable<Scad.IVector2Array[]>; // default: If no path is specified, all points are used in the order listed. single vector: The order to traverse the points. Uses indices from 0 to n-1. May be in a different order and use all or part, of the points listed. multiple vectors: Creates primary and secondary shapes. Secondary shapes are subtracted from the primary shape (like difference()). Secondary shapes may be wholly or partially within the primary shape. A closed shape is created by returning from the last point specified to the first.
		convexity?: IVariable<number>; // Integer number of "inward" curves, ie. expected path crossings of an arbitrary line through the polygon. See below.
	}

	// text
	// The text module creates text as a 2D geometric object, using fonts installed on the local system or provided as separate font file.
	// Parameters
	// text
	//  String. The text to generate.
	// size
	//  Decimal. The generated text has an ascent (height above the baseline) of approximately the given value. Default is 10. Different fonts can vary somewhat and may not fill the size specified exactly, typically they render slightly smaller. On a metric system a size of 25.4 (1" imperial) will correspond to 100pt ⇒ a 12pt font size would be 12×0.254 for metric conversion or 0.12 in imperial.
	// font
	//  String. The name of the font that should be used. This is not the name of the font file, but the logical font name (internally handled by the fontconfig library). This can also include a style parameter, see below. A list of installed fonts & styles can be obtained using the font list dialog (Help -> Font List).
	// halign
	//  String. The horizontal alignment for the text. Possible values are "left", "center" and "right". Default is "left".
	// valign
	//  String. The vertical alignment for the text. Possible values are "top", "center", "baseline" and "bottom". Default is "baseline".
	// spacing
	//  Decimal. Factor to increase/decrease the character spacing. The default value of 1 results in the normal spacing for the font, giving a value greater than 1 causes the letters to be spaced further apart.
	// direction
	//  String. Direction of the text flow. Possible values are "ltr" (left-to-right), "rtl" (right-to-left), "ttb" (top-to-bottom) and "btt" (bottom-to-top). Default is "ltr".
	// language
	//  String. The language of the text. Default is "en".
	// script
	//  String. The script of the text. Default is "latin".
	// $fn
	//  used for subdividing the curved path segments provided by freetype
	export interface ITextOpts {
		text: IVariable<string>; // String. The text to generate.
		size?: IVariable<number>; // Decimal. The generated text has an ascent (height above the baseline) of approximately the given value. Default is 10. Different fonts can vary somewhat and may not fill the size specified exactly, typically they render slightly smaller. On a metric system a size of 25.4 (1" imperial) will correspond to 100pt ⇒ a 12pt font size would be 12×0.254 for metric conversion or 0.12 in imperial.
		font?: IVariable<string>; // String. The name of the font that should be used. This is not the name of the font file, but the logical font name (internally handled by the fontconfig library). This can also include a style parameter, see below. A list of installed fonts & styles can be obtained using the font list dialog (Help -> Font List).
		halign?: IVariable<string>; // String. The horizontal alignment for the text. Possible values are "left", "center" and "right". Default is "left".
		valign?: IVariable<string>; // String. The vertical alignment for the text. Possible values are "top", "center", "baseline" and "bottom". Default is "baseline".
		spacing?: IVariable<number>; // Decimal. Factor to increase/decrease the character spacing. The default value of 1 results in the normal spacing for the font, giving a value greater than 1 causes the letters to be spaced further apart.
		direction?: IVariable<string>; // String. Direction of the text flow. Possible values are "ltr" (left-to-right), "rtl" (right-to-left), "ttb" (top-to-bottom) and "btt" (bottom-to-top). Default is "ltr".
		language?: IVariable<string>; // String. The language of the text. Default is "en".
		script?: IVariable<string>; // String. The script of the text. Default is "latin".
		$fn?: IVariable<number>; // used for subdividing the curved path segments provided by freetype
	}

	// projection
	// Using the projection() function, you can create 2d drawings from 3d models, and export them to the dxf format. It works by projecting a 3D model to the (x,y) plane, with z at 0. If cut=true, only points with z=0 are considered (effectively cutting the object), with cut=false(the default), points above and below the plane are considered as well (creating a proper projection).
	// Parameters
	// cut
	//  Boolean. If true, only points with z=0 are considered (effectively cutting the object), with cut=false(the default), points above and below the plane are considered as well (creating a proper projection).
	export interface IProjectionOpts {
		cut?: IVariable<boolean>; // Boolean. If true, only points with z=0 are considered (effectively cutting the object), with cut=false(the default), points above and below the plane are considered as well (creating a proper projection).
	}

	interface Modules {
		// [name: string]: (...args: any[]) => Scad.Node;

		// Boolean operations
		union: () => (...children: Scad.Node[]) => Scad.Node;
		difference: () => (...children: Scad.Node[]) => Scad.Node;
		intersection: () => (...children: Scad.Node[]) => Scad.Node;

		// Transformations
		translate: (opts: IVariable<Scad.IVector3> | IVariable<ITranslateOpts>) => (...children: Scad.Node[]) => Scad.Node;
		mirror: (opts: IVariable<Scad.IVector3> | IVariable<IMirrorOpts>) => (...children: Scad.Node[]) => Scad.Node;
		rotate: (
			a: IVariable<number> | IVariable<Scad.IVector3> | IVariable<IRotateOpts>
		) => (...children: Scad.Node[]) => Scad.Node;
		color: (color: IVariable<string>, alpha?: IVariable<number>) => (...children: Scad.Node[]) => Scad.Node;
		scale: (opts: IVariable<Scad.IVector3> | IVariable<IScaleOpts>) => (...children: Scad.Node[]) => Scad.Node;
		resize: (opts: IVariable<Scad.IVector3> | IVariable<IResizeOpts>) => (...children: Scad.Node[]) => Scad.Node;
		multimatrix: (
			opts: IVariable<Scad.IVector3Array> | IVariable<IMultmatrixOpts>
		) => (...children: Scad.Node[]) => Scad.Node;
		offset: (opts: IVariable<number> | IVariable<IOffsetOpts>) => (...children: Scad.Node[]) => Scad.Node;
		fill: () => (...children: Scad.Node[]) => Scad.Node;
		hull: () => (...children: Scad.Node[]) => Scad.Node;
		minkowski: () => (...children: Scad.Node[]) => Scad.Node;

		// 3d
		sphere: (radius: IVariable<number> | IVariable<ISphereOpts>) => Scad.Node;
		cube: (size: IVariable<Scad.IVector3> | IVariable<number> | IVariable<ICubeOpts>) => Scad.Node;
		cylinder: (
			h: IVariable<number> | IVariable<ICylinderOpts>,
			r1?: IVariable<number> | IVariable<ICylinderOpts>,
			r2?: IVariable<number> | IVariable<ICylinderOpts>
		) => Scad.Node;
		polyhedron: (opts: IVariable<IPolyhedronOpts>) => Scad.Node;
		linear_extrude: (opts: IVariable<ILinearExtrudeOpts> | IVariable<number>) => (child: Scad.Node) => Scad.Node;
		rotate_extrude: (opts: IVariable<IRotateExtrudeOpts>) => (child: Scad.Node) => Scad.Node;
		// TODO surface

		// 2d
		square: (
			size: IVariable<number> | IVariable<Scad.IVector2> | IVariable<ISquareOpts>,
			opts?: IVariable<ISquareOpts>
		) => Scad.Node;
		circle: (radius: IVariable<number> | IVariable<ICircleOpts>) => Scad.Node;
		polygon: (opts: IVariable<IPolygonOpts> | IVariable<Scad.IVector2Array[]>) => Scad.Node;
		text: (
			text: IVariable<string> | IVariable<Scad.ITextOpts>,
			opts?: IVariable<number> | IVariable<Scad.ITextOpts>
		) => Scad.Node;
		projection: (opts?: IVariable<IProjectionOpts>) => (child: Scad.Node) => Scad.Node;
	}
} // namespace Scad

function sourceFilenameToScadFilename(src: string): string {
	return `${src.replace(/\.ts$/i, "").replace(/\.js$/i, "")}.scad`;
}

export default Scad;
