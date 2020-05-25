const path = require('path');

module.exports = {
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
};
