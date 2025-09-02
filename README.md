# Bandcamp Enhancement Suite

## About

Chrome extension adding extra features to the Bandcamp experience.

The goal of this extension is to make Bandcamp easier to use when navigating larger sets of music (e.g. label pages with large back catalogues). It has been designed with DJs in mind.

## Features

### Preview Button

Provides a "Preview" button on pages with multiple albums. This button will open a player on the same page giving a quick and easy way to listen to tracks without having to navigate away from the page.

### History Tracking

Adds a history display element next to album. This element is a clickable toggle which persists between page loads thus providing a history. This toggle is automatically set when `preview` button is used and can be manually clicked.

### Keyboard Bindings

On album and track pages the following keyboard controls are supported:

| Key Binding         | Action                        |
| ------------------- | ----------------------------- |
| Space Bar and "p"   | Play/Pause                    |
| Right Arrow         | Move Playhead Forward 10s     |
| Left Arrow          | Move Playhead Back 10s        |
| Shift + Right Arrow | Move Playhead Forward 30s     |
| Shift + Left Arrow  | Move Playhead Back 30s        |
| Down Arrow          | Play Next Track               |
| Up Arrow            | Play Previous Track           |
| Shift + Up Arrow    | Increase Audio Volume by 0.05 |
| Shift + Down Arrow  | Decrease Audio Volume by 0.05 |

### Advanced Mouse Playbar

Click anywhere on the playbar to set the "playhead" of the player.

### Waveform Display

Adds a wavform display similar to visualization of Soundcloud. A toggle below the "play button" on album pages will enable/disable the display.
**Note**: The waveform is processed browserside.

### BPM Estimate

Adds a BPM estimate for tracks played on Album or Track page.
**Note**: The bpm estimation is processed browserside.

### Volume Control

Adds a slider on the right side of the player controls volume.

### Control Relocation

Moves the forward/back buttons for the player (on album and track pages) to right under the play/pause button.

### Tracklist Relocation

Moves the tracklist on an album's page directly below the player.

### Bundle Purchase Download Button

Adds a button to help automate the process of download a cart after purchase. Once all music download links are ready this button, when clicked, generate a `.txt` file which can be **pasted** into [terminal](https://en.wikipedia.org/wiki/List_of_terminal_emulators) to automate the downloading process. This `.txt` file uses [cURL](https://en.wikipedia.org/wiki/CURL).

Additionally, while the generated file is a `.txt`, it can be run directly in terminal with the command:

```
. ./bandcamp_*.txt
```

This will download the files into the same directory the terminal session is in.

### 1-Click Purchase

Adds buttons on track and album pages to easily add an item to your cart with a single click.

## Installation

Available from the [Chrome webstore](https://chrome.google.com/webstore/detail/bandcamp-label-view/padcfdpdlnpdojcihidkgjnmleeingep) and [Firefox Addons](https://addons.mozilla.org/en-US/firefox/addon/bandcamp-enhancement-suite)

## Feedback

Feedback, feature requests, and bug reports are always welcome.

## Development

This project uses `webpack` to generate the final project files from npm packages. This allows the use of `import` statements.

### Quick Start

From the root of the project run:

```
npm install
```

This will grab all of the js dependencies.

Different `npm` commands defined in the `scripts` section of `package.json` can be used for to preform various tasks.

#### build

run:

```sh
# Defaults to --mode=production:
npm run build
```

this will generate js files in `./dist`.

Continuous rebuild when files update:

```sh
# Defaults to --mode=development:
npm run build:watch
```

#### linter

```sh
# Show ESLint issues:
npm run lint

# Auto-fix ESLint issues, if possible:
npm run lint:fix
```

#### test

run:

```sh
# Single run:
npm test

# Watch & auto-rebuild:
npm run test:watch
```

Testing documentation:

- [Mocha: test framework](https://mochajs.org/)
- [Chai: assertion logic](https://www.chaijs.com/api/assert/)
- [Sinon-Chrome: Mock Chrome extension methods](https://github.com/acvetkov/sinon-chrome)
- [Sinon: mocks, spies, assertions](https://sinonjs.org/releases/v9.0.2/assertions/)
- [Karma test runner](https://karma-runner.github.io/)

#### distribution

run:

```sh
npm run package
```

This sets `NODE_ENV=production` which silences debug-level logging, and outputs a `.zip` file for distribution.
