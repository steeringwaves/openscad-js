"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var indent = "\t";
function writeNode(depth, node) {
    if ("module" === node.type) {
        var props = node.props;
        return writeModule(depth, props.name, props.args, props.children);
    }
    if ("object" === node.type) {
        var props = node.props;
        return writeObject(depth, props.name, props.args);
    }
    if ("modifier" === node.type) {
        var props = node.props;
        return writeModifier(depth, props.symbol, props.child);
    }
    if ("variable" === node.type) {
        var props = node.props;
        return writeVariable(depth, props.name, props.args);
    }
    throw new Error("unexpected node ".concat(node));
}
function writeIndent(depth) {
    return indent.repeat(depth);
}
function writeModule(depth, name, args, children) {
    return "".concat(name, "(").concat(writeArgs(args), ") {\n").concat(children.map(function (c) { return writeIndent(depth + 1) + writeNode(depth + 1, c); }).join("\n"), "\n").concat(writeIndent(depth), "}");
}
function writeObject(depth, name, args) {
    return "".concat(name, "(").concat(writeArgs(args), ");");
}
function writeVariable(depth, name, args) {
    return "".concat(name, " = ").concat(writeArgs(args), ";");
}
function writeArgs(args) {
    return args
        .filter(function (arg) {
        return "number" === typeof arg ||
            "boolean" === typeof arg ||
            "string" === typeof arg ||
            Array.isArray(arg) ||
            Object.entries(arg).length > 0;
    })
        .map(function (arg) { return writeValue(arg, true); })
        .join(", ");
}
function writeValue(value, isArg) {
    if (isArg === void 0) { isArg = false; }
    if (value instanceof Scad.Variable) {
        return value.name;
    }
    if ("number" === typeof value || "boolean" === typeof value) {
        return String(value);
    }
    if ("string" === typeof value) {
        return "\"".concat(value.replace(/"/g, '"'), "\"");
    }
    if (Array.isArray(value)) {
        return "[".concat(value.map(function (v) { return writeValue(v); }).join(", "), "]");
    }
    if (isArg) {
        return Object.entries(value)
            .map(function (_a) {
            var k = _a[0], v = _a[1];
            return "".concat(k, "=").concat(writeValue(v));
        })
            .join(", ");
    }
    throw new Error("unexpected value ".concat(value));
}
function writeModifier(depth, symbol, child) {
    return symbol + writeNode(depth, child);
}
function compile(node) {
    if (Array.isArray(node)) {
        return node.map(function (n) { return writeNode(0, n); }).join("\n");
    }
    return writeNode(0, node);
}
function defineModule(name) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var result = function scadModule() {
            var children = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                children[_i] = arguments[_i];
            }
            return { type: "module", props: { name: name, args: args, children: children } };
        };
        Object.assign(result, { type: "object", props: { name: name, args: args } });
        return result;
    };
}
function defineModifier(symbol) {
    return function (child) { return ({ type: "modifier", props: { symbol: symbol, child: child } }); };
}
var proxyModules = new Proxy({
    _bg: defineModifier("%"),
    _debug: defineModifier("#"),
    _root: defineModifier("!"),
    _disable: defineModifier("*")
}, {
    get: function (obj, prop) { return (prop in obj ? obj[prop] : defineModule(prop)); }
});
var Scad;
(function (Scad) {
    var Node = /** @class */ (function () {
        function Node(type, props) {
            this.type = type;
            this.props = props;
        }
        return Node;
    }());
    Scad.Node = Node;
    var Variable = /** @class */ (function () {
        function Variable(name, value, opts) {
            this.name = name;
            this.value = value;
            this.opts = opts;
        }
        Variable.prototype.toString = function () {
            var comment = "";
            if (this.opts && this.opts.comment) {
                comment += "// ".concat(this.opts.comment, "\n");
            }
            return "".concat(comment).concat(writeVariable(0, this.name, [this.value]), "\n");
        };
        return Variable;
    }());
    Scad.Variable = Variable;
    var Specials = /** @class */ (function () {
        function Specials() {
        }
        Specials.prototype.toString = function () {
            var entries = Object.entries(this).filter(function (_a) {
                var k = _a[0], v = _a[1];
                return undefined !== v;
            });
            if (0 === entries.length) {
                return "";
            }
            return "/* Specials */\n\n".concat(entries.map(function (_a) {
                var k = _a[0], v = _a[1];
                return writeVariable(0, k, [v]);
            }).join("\n"), "\n");
        };
        return Specials;
    }());
    Scad.Specials = Specials;
    var Module = /** @class */ (function () {
        function Module() {
            this.any = proxyModules;
            this.modules = proxyModules;
            this.specials = new Specials();
            this.entires = [];
            this.variables = [];
        }
        Module.prototype.addVariable = function (name, value, opts) {
            var v = new Variable(name, value, opts);
            this.variables.push(v);
            return v;
        };
        Module.prototype.add = function (node) {
            this.entires.push(node);
            return node;
        };
        Module.prototype.addMultiple = function (nodes) {
            var _a;
            (_a = this.entires).push.apply(_a, nodes);
            return nodes;
        };
        Module.prototype.toString = function () {
            var variableText = "";
            var sections = {};
            var noSections = [];
            for (var i = 0; i < this.variables.length; i++) {
                var v = this.variables[i];
                if (v.opts && v.opts.section) {
                    if (!sections[v.opts.section]) {
                        sections[v.opts.section] = [];
                    }
                    sections[v.opts.section].push(v);
                }
                else {
                    noSections.push(v);
                }
            }
            if (noSections.length > 0) {
                variableText += "/* Variables */\n\n";
                variableText += noSections.map(function (v) { return v.toString(); }).join("\n");
                variableText += "\n";
            }
            // get list of sections alphabetically
            var sectionNames = Object.keys(sections).sort();
            // loop through all sections
            if (sectionNames.length > 0) {
                for (var i = 0; i < sectionNames.length; i++) {
                    var sectionName = sectionNames[i];
                    var section = sections[sectionName];
                    variableText += "/* [ ".concat(sectionName, " ] */\n\n");
                    variableText += section.map(function (v) { return v.toString(); }).join("\n");
                }
                variableText += "\n";
            }
            return "/* AUTOGENERATED FILE USING @steeringwaves/openscad-js DO NOT MODIFY */\n\n".concat(this.specials.toString(), "\n").concat(variableText, "\n").concat(compile(this.entires));
        };
        Module.prototype.toFile = function (fs, filename, verbose) {
            var scadSrc = this.toString();
            if (verbose) {
                console.log(scadSrc);
            }
            fs.writeFileSync(filename, scadSrc);
        };
        Module.prototype.toScadFile = function (fs, src, verbose) {
            this.toFile(fs, sourceFilenameToScadFilename(src), verbose);
        };
        return Module;
    }());
    Scad.Module = Module;
})(Scad || (Scad = {})); // namespace Scad
function sourceFilenameToScadFilename(src) {
    return "".concat(src.replace(/\.ts$/i, "").replace(/\.js$/i, ""), ".scad");
}
exports.default = Scad;
//# sourceMappingURL=index.js.map