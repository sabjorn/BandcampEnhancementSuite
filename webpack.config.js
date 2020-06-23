const path = require('path');
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery"
    })
  ],
  node: { fs: 'empty' },
  mode: 'production',
  entry: {
    content: './src/label_view.js',
    background: './src/background.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    // We no not want to minimize our code.
    minimize: false
  },
  devtool: "inline-source-map", //fixes "eval" error in chrome

  // Run with --watch to enable these options
  watchOptions: {
    ignored: /node_modules/
  }
};
