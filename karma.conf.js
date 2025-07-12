// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    browsers: [
      'ChromeHeadless', // Use this for CI and regular testing
      //'Chrome',       // Use this for viewing chrome.runtime errors
      //'Firefox',      // Maybe in the future?
    ],

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
    browserNoActivityTimeout: 300000,

    // Explicitly list required karma plugins
    plugins: [
      'karma-mocha', 
      'karma-chai',
      'karma-chrome-launcher',
      'karma-spec-reporter'
    ],
    colors: true,
    
    // For now, run tests directly without preprocessing
    // In the future, we can add TypeScript support here
    files: [
      // Include test utilities first
      { pattern: 'test/utils.js', watched: true },
      // Include built source files for testing
      { pattern: 'dist/**/*.js', included: false, served: true, watched: false },
      // Include test files
      { pattern: 'test/**/*.js', watched: true },
    ],

    // Temporarily disable webpack preprocessing since we removed webpack
    preprocessors: {},

    client: {
      mocha: {
        // change Karma's debug.html to the mocha web reporter
        reporter: 'html'
      }
    }
  });
};