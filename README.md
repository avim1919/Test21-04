# Tetris

A polished, modern Tetris clone built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step.

**Play it live:** https://avim1919.github.io/Test21-04/

## Features

- Classic 10×20 playfield with all 7 tetrominoes
- 7-bag randomizer (fair piece distribution)
- Hold piece, next piece preview
- Ghost piece showing where the current piece will land
- Soft drop, hard drop, CW / CCW rotation with basic wall kicks
- Scoring, levels, line clears, high score (saved to `localStorage`)
- Keyboard + on-screen controls (mobile-friendly)
- Responsive layout with a modern UI

## Controls

| Key | Action |
| --- | --- |
| ← / → | Move left / right |
| ↓ | Soft drop |
| Space | Hard drop |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| C | Hold piece |
| P | Pause / resume |

## Run locally

Just open `index.html` in your browser. Or serve it with any static server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
.
├── index.html    # Markup + layout
├── styles.css    # Styles
├── tetris.js     # Game logic & rendering
└── README.md
```

## License

MIT
