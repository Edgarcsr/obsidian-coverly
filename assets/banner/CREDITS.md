# Banner credits

`banner.png` shows a note in Obsidian with a Coverly cover and icon. Third-party material in it:

| Item | Source |
| --- | --- |
| Cover: night photo of Tokyo (`art/tokyo.png`) | Provided by the project author. The photographer and license are not recorded, so the file is **not versioned** (git-ignored). Replace it with an image you may redistribute before rebuilding. |
| Page icon: mahjong red dragon emoji (`art/mahjong-emoji.svg`) | [Twemoji](https://github.com/jdecked/twemoji) graphics, CC-BY 4.0, from the `@twemoji/svg` package. |
| Check mark in the brand tile | [Lucide](https://lucide.dev) `check` icon (ISC). It stands in for the plugin icon; the Coverly logo is not used because Obsidian does not allow custom plugin logos. |
| Dithered notebook with a pen in the background | [Lucide](https://lucide.dev) `notebook-pen` icon (ISC), dithered by `dither.js`. |
| Font | Geist, SIL Open Font License (`fonts/geist.woff2`). |

## Rebuild

Put the cover at `art/tokyo.png`, edit `banner.src.html`, run `bun build.ts` in this folder (it inlines the fonts, images and `dither.js` into a self-contained `banner.html`, which is git-ignored) and render that file to a 1200x630 PNG.
