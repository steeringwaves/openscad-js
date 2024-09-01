interface IFileSystem {
    writeFileSync(file: string, data: string): void;
}
interface IFileSystem {
    writeFileSync(file: string, data: string): void;
}
declare namespace Scad {
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
        constructor(type: string, props: IVariableProps | IModuleProps | IModifierProps | IObjectProps);
    }
    export interface IVariableOpts {
        section?: string;
        comment?: string;
    }
    export class Variable<T> {
        parent: Module;
        name: string;
        value: T;
        opts?: IVariableOpts;
        constructor(parent: Module, name: string, value: T, opts?: IVariableOpts);
        toString(): string;
    }
    export class Specials {
        parent: Module;
        $fa: number | undefined;
        $fs: number | undefined;
        $fn: number | undefined;
        $t: number | undefined;
        $vpr: Scad.IVector3 | Scad.IVector2 | undefined;
        $vpt: Scad.IVector3 | Scad.IVector2 | undefined;
        $vpd: number | undefined;
        $vpf: number | undefined;
        $children: number | undefined;
        $preview: boolean | undefined;
        constructor(parent: Module);
        toString(): string;
    }
    export interface IModuleOptions {
        fs?: IFileSystem;
        indent?: string;
        banner?: string;
    }
    export class Module {
        any: any;
        modules: Modules;
        specials: Specials;
        private entries;
        private variables;
        indent: string;
        banner: string;
        fs: IFileSystem | undefined;
        constructor(opts?: IModuleOptions);
        addVariable<T>(name: string, value: T, opts?: IVariableOpts): Scad.Variable<T>;
        add(node: Scad.Node): Scad.Node;
        addMultiple(nodes: Scad.Node[]): Scad.Node[];
        toString(): string;
        toFile(filename: string, verbose?: boolean): void;
        toScadFile(src: string, verbose?: boolean): void;
        writeNode(depth: number, node: Scad.Node): string;
        writeIndent(depth: number): string;
        writeModule(depth: number, name: string, args: any[], children: Scad.Node[]): string;
        writeObject(depth: number, name: string, args: any[]): string;
        writeVariable(depth: number, name: string, args: any[]): string;
        writeArgs(args: any[]): string;
        writeValue(value: any, isArg?: boolean): string;
        writeModifier(depth: number, symbol: string, child: Scad.Node): string;
        compile(node: Scad.Node | Scad.Node[]): string;
        defineModule(name: string): (...args: any[]) => (...children: Scad.Node[]) => {
            type: string;
            props: Scad.IModuleProps;
        };
        defineModifier(symbol: string): (child: Scad.Node) => {
            type: string;
            props: Scad.IModifierProps;
        };
    }
    export interface IVector2 extends Array<number> {
        0: number;
        1: number;
    }
    export interface IVector3 extends Array<number> {
        0: number;
        1: number;
        2: number;
    }
    export interface IVector3Boolean extends Array<boolean> {
        0: boolean;
        1: boolean;
        2: boolean;
    }
    export interface IVector3Array extends Array<IVector3> {
    }
    export interface IVector2Array extends Array<IVector2> {
    }
    interface ITranslateOpts {
        v?: IVariable<Scad.IVector3>;
    }
    interface IScaleOpts {
        v?: IVariable<Scad.IVector3>;
    }
    interface IResizeOpts {
        newsize?: IVariable<Scad.IVector3>;
        auto?: IVariable<boolean> | IVariable<Scad.IVector3Boolean>;
    }
    interface IMirrorOpts {
        v?: IVariable<Scad.IVector3>;
    }
    interface IMultmatrixOpts {
        m?: IVariable<Scad.IVector3Array>;
    }
    interface IOffsetOpts {
        r?: IVariable<number>;
        delta?: IVariable<number>;
        chamfer?: IVariable<boolean>;
    }
    interface IRotateOpts {
        a?: IVariable<number> | IVariable<Scad.IVector3>;
        v?: IVariable<Scad.IVector3>;
    }
    interface ICubeOpts {
        size?: IVariable<Scad.IVector3> | IVariable<number>;
        center?: IVariable<boolean>;
    }
    interface ISphereOpts {
        d?: IVariable<number>;
        r?: IVariable<number>;
        $fa?: IVariable<number>;
        $fs?: IVariable<number>;
        $fn?: IVariable<number>;
    }
    interface ICylinderOpts {
        h?: IVariable<number>;
        r?: IVariable<number>;
        r1?: IVariable<number>;
        r2?: IVariable<number>;
        d?: IVariable<number>;
        d1?: IVariable<number>;
        d2?: IVariable<number>;
        center?: IVariable<boolean>;
        $fa?: IVariable<number>;
        $fs?: IVariable<number>;
        $fn?: IVariable<number>;
    }
    interface IPolyhedronOpts {
        points: IVariable<Scad.IVector3Array>;
        triangles?: IVariable<Scad.IVector3Array>;
        faces?: IVariable<Scad.IVector3Array>;
        convexity?: IVariable<number>;
    }
    interface ILinearExtrudeOpts {
        height: IVariable<number>;
        twist?: IVariable<number>;
        center?: IVariable<boolean>;
        slices?: IVariable<number>;
        scale?: IVariable<number> | IVariable<Scad.IVector3>;
        $fn?: IVariable<number>;
    }
    interface IRotateExtrudeOpts {
        convexity?: IVariable<number>;
        angle?: IVariable<number>;
        $fa?: IVariable<number>;
        $fs?: IVariable<number>;
        $fn?: IVariable<number>;
    }
    interface ISquareOpts {
        size?: IVariable<Scad.IVector2> | IVariable<number>;
        center?: IVariable<boolean>;
    }
    interface ICircleOpts {
        r?: IVariable<number>;
        d?: IVariable<number>;
        $fa?: IVariable<number>;
        $fs?: IVariable<number>;
        $fn?: IVariable<number>;
    }
    interface IPolygonOpts {
        points: IVariable<Scad.IVector2Array>;
        paths?: IVariable<Scad.IVector2Array> | IVariable<Scad.IVector2Array[]>;
        convexity?: IVariable<number>;
    }
    export interface ITextOpts {
        text: IVariable<string>;
        size?: IVariable<number>;
        font?: IVariable<string>;
        halign?: IVariable<string>;
        valign?: IVariable<string>;
        spacing?: IVariable<number>;
        direction?: IVariable<string>;
        language?: IVariable<string>;
        script?: IVariable<string>;
        $fn?: IVariable<number>;
    }
    export interface IProjectionOpts {
        cut?: IVariable<boolean>;
    }
    interface Modules {
        union: () => (...children: Scad.Node[]) => Scad.Node;
        difference: () => (...children: Scad.Node[]) => Scad.Node;
        intersection: () => (...children: Scad.Node[]) => Scad.Node;
        translate: (opts: IVariable<Scad.IVector3> | IVariable<ITranslateOpts>) => (...children: Scad.Node[]) => Scad.Node;
        mirror: (opts: IVariable<Scad.IVector3> | IVariable<IMirrorOpts>) => (...children: Scad.Node[]) => Scad.Node;
        rotate: (a: IVariable<number> | IVariable<Scad.IVector3> | IVariable<IRotateOpts>) => (...children: Scad.Node[]) => Scad.Node;
        color: (color: IVariable<string>, alpha?: IVariable<number>) => (...children: Scad.Node[]) => Scad.Node;
        scale: (opts: IVariable<Scad.IVector3> | IVariable<IScaleOpts>) => (...children: Scad.Node[]) => Scad.Node;
        resize: (opts: IVariable<Scad.IVector3> | IVariable<IResizeOpts>) => (...children: Scad.Node[]) => Scad.Node;
        multimatrix: (opts: IVariable<Scad.IVector3Array> | IVariable<IMultmatrixOpts>) => (...children: Scad.Node[]) => Scad.Node;
        offset: (opts: IVariable<number> | IVariable<IOffsetOpts>) => (...children: Scad.Node[]) => Scad.Node;
        fill: () => (...children: Scad.Node[]) => Scad.Node;
        hull: () => (...children: Scad.Node[]) => Scad.Node;
        minkowski: () => (...children: Scad.Node[]) => Scad.Node;
        sphere: (radius: IVariable<number> | IVariable<ISphereOpts>) => Scad.Node;
        cube: (size: IVariable<Scad.IVector3> | IVariable<number> | IVariable<ICubeOpts>) => Scad.Node;
        cylinder: (h: IVariable<number> | IVariable<ICylinderOpts>, r1?: IVariable<number> | IVariable<ICylinderOpts>, r2?: IVariable<number> | IVariable<ICylinderOpts>) => Scad.Node;
        polyhedron: (opts: IVariable<IPolyhedronOpts>) => Scad.Node;
        linear_extrude: (opts: IVariable<ILinearExtrudeOpts> | IVariable<number>) => (child: Scad.Node) => Scad.Node;
        rotate_extrude: (opts: IVariable<IRotateExtrudeOpts>) => (child: Scad.Node) => Scad.Node;
        square: (size: IVariable<number> | IVariable<Scad.IVector2> | IVariable<ISquareOpts>, opts?: IVariable<ISquareOpts>) => Scad.Node;
        circle: (radius: IVariable<number> | IVariable<ICircleOpts>) => Scad.Node;
        polygon: (opts: IVariable<IPolygonOpts> | IVariable<Scad.IVector2Array[]>) => Scad.Node;
        text: (text: IVariable<string> | IVariable<Scad.ITextOpts>, opts?: IVariable<number> | IVariable<Scad.ITextOpts>) => Scad.Node;
        projection: (opts?: IVariable<IProjectionOpts>) => (child: Scad.Node) => Scad.Node;
    }
    export {};
}
export default Scad;
