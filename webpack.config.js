const path = require('path');

module.exports = {
  entry: './src/label_view.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    // We no not want to minimize our code.
    minimize: false
  },
};
