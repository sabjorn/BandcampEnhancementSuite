// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    browsers: [
      'ChromeHeadless', // Use this for CI and regular testing
      //'Chrome',       // Use this for viewing chrome.runtime errors
      //'Firefox',      // Maybe in the future?
    ],
    //singleRun: true,

    /**
     * Level of logging
     * possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
     */
    logLevel: config.LOG_WARN,

    /**
     * Test results reporter to use
     * possible values: 'dots', 'progress'
     * available reporters: https://npmjs.org/browse/keyword/karma-reporter
     */
    reporters: ['spec'],

    /**
     * For slower machines you may need to have a longer browser
     * wait time . Uncomment the line below if required.
     */
    // browserNoActivityTimeout: 30000

    // 'karma-*' is default and loads all available plugins. Kept here
    // for visibility and to prevent accidental override.
    plugins: ['karma-*'],
    colors: true,
    files: [
      // each file acts as entry point for the webpack configuration
      { pattern: 'test/**/*.js', watched: true },
    ],

    preprocessors: {
      // add webpack as preprocessor
      './test/**/*.js': ['webpack'],
    },

    webpack: require('./webpack.test.config.js'),
    webpackMiddleware: {
      // webpack-dev-middleware configuration
      stats: 'errors-only',
      noInfo: true
    },
    client: {
      mocha: {
        // change Karma's debug.html to the mocha web reporter
        reporter: 'html'
      }
    }
  });
};