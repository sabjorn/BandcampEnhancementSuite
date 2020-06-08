const { runner } = require("mocha-headless-chrome");

const options = {
  file: "./test/download_helper.html", // test page path
  reporter: "spec", // mocha reporter name
  args: ["no-sandbox"] // chrome arguments
  //visible: true,          // show chrome window
};

runner(options).then(result => {
  let json = JSON.stringify(result);
  // Optional: dump JSON results
  //console.log(json);
});
