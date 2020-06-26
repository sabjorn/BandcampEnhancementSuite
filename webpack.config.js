const path = require('path');
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery"
    })
  ],

  // Since this is a browser app, explicitly disable NodeJS's `fs` methods.
  // This prevents transpilation errors for libraries like Winston that
  // offer support for server-side features.
  node: {
    fs: 'empty'
  },

  // Default to production, override with --mode=development.
  // See https://webpack.js.org/configuration/mode/ for the features included
  // with either build.
  mode: 'production',

  entry: {
    content: './src/label_view.js',
    background: './src/background.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },

  // Fixes the "eval" error in Chrome
  devtool: "inline-source-map",

  // Run with --watch to enable these options
  watchOptions: {
    ignored: /node_modules/
  }
};
