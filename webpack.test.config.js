/**
 * This file overrides some Webpack settings specifically for unit tests.
 */
const path = require("path");
const webpack = require("webpack");

const baseConfig = require("./webpack.config");

const config = baseConfig({}, { mode: "development" });

module.exports = {
  ...config,
  mode: "development",
  performance: { hints: false }
};
