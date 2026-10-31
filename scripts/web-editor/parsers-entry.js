import * as html from "parse5";
import * as css from "css-tree";
import { init, parse as modules } from "es-module-lexer/minimal";
self.AgataWebParsers = { html, css, modules, ready: init() };
