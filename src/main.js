// Phase 1 entry point: the whole game still ships as one extracted IIFE.
// index.html loads src/three.js as a CLASSIC script before this module,
// because the vendored r170 block declares its API as top-level consts in
// the global lexical scope — and src/game.js reads them as bare globals
// (WebGLRenderer, Scene, ...). Do not import three.js as a module: its
// consts would become module-private and the game would not boot.
import './game.js';
