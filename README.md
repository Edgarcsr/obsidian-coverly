<div align="center">

<img src="assets/banner/banner.png" alt="Coverly: Notion-style page covers and icons for Obsidian" width="100%">

<p>&nbsp;</p>

<p>
  <a href="https://github.com/Edgarcsr/obsidian-coverly/releases"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/downloads/Edgarcsr/obsidian-coverly.svg?variant=outline&mode=dark&color=a68af9"><img src="https://shieldcn.dev/github/downloads/Edgarcsr/obsidian-coverly.svg?variant=outline&mode=light&color=7c3aed" alt="Downloads"></picture></a>
  <a href="https://obsidian.md"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Obsidian-1.13.0%2B-A68AF9.svg?logo=obsidian&variant=outline&mode=dark"><img src="https://shieldcn.dev/badge/Obsidian-1.13.0%2B-7c3aed.svg?logo=obsidian&variant=outline&mode=light" alt="Obsidian 1.13.0+"></picture></a>
  <a href="LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/license/Edgarcsr/obsidian-coverly.svg?variant=outline&mode=dark&color=a68af9"><img src="https://shieldcn.dev/github/license/Edgarcsr/obsidian-coverly.svg?variant=outline&mode=light&color=7c3aed" alt="License"></picture></a>
</p>

<p>
  <a href="https://youtu.be/qEFwSZ2j1Ho"><b>Watch the video overview on YouTube</b></a>
</p>

</div>

## Features

- **Page covers**: pick a color or gradient, a public domain artwork, an Unsplash photo, an uploaded image, a link, or paste an image with **Ctrl+V**. Drag to reposition. Height, rounded corners, bottom fade and bottom shade are configurable.
- **Note background** (beta, off by default, **Settings → Coverly**): give a single note a color, gradient, vault image or linked image as its background, softened so the text stays readable. Use **Change note background** from the command palette or the button above the title.
- **Accent color per note** (off by default, **Settings → Coverly**): change the theme's accent color (links, buttons, checkboxes) for a single note.
- **Vault images**: pick covers, icons and backgrounds from images already in your vault.
- **Note font**: switch a single note between the theme font, a serif and a monospace font, from the command palette or the button above the title. With **Custom fonts per note** on (off by default), you can also type the name of any font installed on your computer.
- **Colored names** (off by default, **Settings → Coverly**): pick a color for a note and its name is painted with it in the file explorer.
- **Page icons**: any Unicode emoji (optionally drawn with Twemoji), any Lucide icon in a color of your choice, an icon from an installed icon pack, or a custom image.
- **Icon packs**: Lucide is built in. In **Settings → Coverly → Icon packs** you can install [Symbols](https://github.com/miguelsolorio/vscode-symbols) (colored file and folder icons), [Tabler](https://tabler.io/icons) and [Phosphor](https://phosphoricons.com), all MIT licensed. Each installed pack gets its own tab under **Icons** in the icon picker, and any pack, Lucide included, can be hidden from there.
- **Icons everywhere**: the note icon also shows in the tab title and the file explorer.
- **Folder icons**: right-click a folder in the file explorer and select **Change icon** to give it an icon, shown before its name. Notes have the same **Change icon** and **Remove icon** items.
- **Heading outline**: a slim outline on the right edge of the note that expands on hover and jumps to a heading on click.
- **English and Portuguese** interface, following Obsidian's language by default.

Covers and icons are stored in the note's frontmatter (`coverly-cover`, `coverly-position`, `coverly-credit`, `coverly-credit-url`, `coverly-icon`, `coverly-background`, `coverly-font`, `coverly-accent`, `coverly-color`; notes using the older `cover`/`icon` names are still read and are migrated the next time you change them), so your notes stay plain Markdown. Folders have no frontmatter, so folder icons are stored in the plugin's `data.json`, by folder path, and follow the folder when it is renamed or moved.

## Network use

Coverly works offline. It only reaches the network for these features:

- **Unsplash** (`api.unsplash.com`, `images.unsplash.com`): searching photos and loading the ones you pick, only after you add your own Unsplash access key in the settings. Picking a photo also sends Unsplash a download notice, as their API guidelines require.
- **Twemoji** (`cdn.jsdelivr.net`): downloading emoji images the first time they appear. They are cached in the plugin folder. Turn off **X-style emojis** in the settings to use system emojis instead.
- **Icon packs** (`cdn.jsdelivr.net`, `data.jsdelivr.com`): only when you select **Install** on a pack. The whole pack is downloaded once and saved in `icon-packs/` inside the Coverly folder; after that it works offline. Like the rest of that folder, Obsidian Sync skips it when the folder name starts with a dot, so install the pack on each device.
- **Gallery artworks** (`images.metmuseum.org`, `commons.wikimedia.org`, which redirects to `upload.wikimedia.org`): loading the public domain images shown in the cover gallery.
- **Images from links**: if a cover or icon comes from a web address, Obsidian loads that image from its host each time the note is shown, unless **Download covers** is on.
- **Download covers** (off by default, **Settings → Coverly**): saves a copy of each cover that comes from the web (Unsplash, gallery artworks, links) in a vault folder (`.coverly` by default; an existing `.cover` folder is renamed on update), so it opens from disk instead of the network. Covers are downloaded from their original host the first time they are shown, or all at once with **Download all covers used in the vault** from the command palette. The note still stores the original address, so it keeps working in other vaults. Obsidian Sync skips folders whose name starts with a dot, so each device keeps its own copies unless you choose a different folder.
- **Cover thumbnails**: Coverly keeps a tiny blurred copy of each photo cover in `thumbs/` inside that folder, shown while the full image loads and used by **Backgrounds in the explorer** (off, images only, notes only, or both). For a cover from a web address, making the thumbnail fetches the image once from its host (reusing the downloaded copy when **Download covers** is on).

No note content, file names or personal data are sent anywhere.

## Vault and clipboard access

Everything below stays on your device:

- **File list**: the cover and icon pickers list the images in your vault (**From your vault**). Coverly also reads the frontmatter of your notes from Obsidian's cache to prepare cover thumbnails, to count which notes use an image before you delete it, and for **Download all covers used in the vault**.
- **Clipboard**: images and links are read only when you paste them with Ctrl/Cmd+V into the cover or icon picker. The clipboard is written only when you select **Copy JSON** in the performance report.
- **Performance monitor** (off by default, **Settings → Coverly → Developer**): measures timings in memory only. Nothing is saved or sent.

## Installation

Until Coverly is listed in the community catalog, install it manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Copy them to `<Vault>/.obsidian/plugins/coverly/`.
3. Reload Obsidian and enable **Coverly** in **Settings → Community plugins**.

## Development

```bash
bun install
bun run dev
```

`bun run build` makes a production build and `bun run check` runs the linter and formatter checks.

### Releasing

Releases are automated. Bump the version in `manifest.json`, `package.json`
and `versions.json` (`bun run version` does it from `package.json`), then push
to `main`. If that version has no release yet, the **Release Obsidian plugin**
workflow builds the plugin, creates the tag (no `v` prefix) and publishes the
release with `main.js`, `manifest.json` and `styles.css`.

## License

[MIT](LICENSE)
