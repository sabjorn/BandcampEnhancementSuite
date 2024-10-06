const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode !== "development";

  return {
    module: {
      rules: [
        {
          test: /\.html$/i,
          use: "raw-loader"
        }
      ]
    },
    plugins: [],

    node: {
      fs: "empty"
    },

    mode: isProduction ? "production" : "development",

    optimization: {
      usedExports: true, // Enable tree shaking
      minimize: isProduction,
      minimizer: isProduction
        ? [
            new TerserPlugin({
              terserOptions: {
                compress: {}
              }
            })
          ]
        : []
    },

    entry: {
      main: "./src/main.js",
      background: "./src/background.js"
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist")
    },

    devtool: isProduction ? false : "inline-source-map",

    watchOptions: {
      ignored: /node_modules/
    }
  };
};
