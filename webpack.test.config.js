/**
 * This file overrides some Webpack settings specifically for unit tests.
 */
const path = require('path');
const webpack = require('webpack');

const defaults = require('./webpack.config')

module.exports = {
  ...defaults,
  mode: 'development',
  performance: { hints: false }
};
