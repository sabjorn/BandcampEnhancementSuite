// karma.conf.js
module.exports = function(config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    browsers: ['ChromeHeadless'],
    //singleRun: true,
    // logLevel: 'debug',
    reporters: ['progress'],
    colors: true,
    //port: 9090


    files: [
      // each file acts as entry point for the webpack configuration
      //{ pattern: 'test/download_helper.js', watched: false },
      { pattern: 'test/background.js', watched: true },
      // { pattern: 'test/*.js', watched: true },
    ],

    preprocessors: {
      // add webpack as preprocessor
      'test/**/*.js': ['webpack'],
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
        reporter: 'html',

        // require specific files after Mocha is initialized
        //require: [require.resolve('jsdom-global/register')],

        // custom ui, defined in required file above
        //ui: 'bdd-lazy-var/global',
      }
    }
  });
};