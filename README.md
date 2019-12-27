# Bandcamp Enhancement Suite
## About
Chrome extension adding extra features to the Bandcamp experience.

The goal of this extension is to make Bandcamp easier to use when navigating larger sets of music (e.g. label pages with large back catalogues). It has been designed with DJs in mind.

## Features
### Preview Button
Provides a "Preview" button on pages with multiple albums. This button will open a player on the same page giving a quick and easy way to listen to tracks without having to navigate away from the page.

### History Tracking
Adds a history display element next to album. This element is a clickable toggle which persists between page loads thus providing a history. This toggle is automatically set when `preview` button is used and can be manually clicked.  

## Installation
Available from the [Chrome webstore](https://chrome.google.com/webstore/detail/bandcamp-label-view/padcfdpdlnpdojcihidkgjnmleeingep)

## Feedback
Feedback, feature requests, and bug reports are always welcome.

## Development

Requires a NodeJS environment, using [nvm](https://github.com/nvm-sh/nvm) makes setup easy.

```sh
# Install CLI tooling
npm install

# Run the linter
npm run lint
```