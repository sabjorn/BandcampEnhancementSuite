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

```
npm run build
```
this will generate js files in `./dist`.

#### linter

run:
```
npm run lint
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
