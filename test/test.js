const { runner } = require("mocha-headless-chrome");

// General options
const options = {
  reporter: "spec", // mocha reporter name
  args: ["no-sandbox"] // chrome arguments
  //visible: true,          // show chrome window
};

// Test 1: Download Helper
options.file = "./test/download_helper/mock.html"
runner(options).then(result => {
  let json = JSON.stringify(result);
  // Optional: dump JSON results
  //console.log(json);
});

// Test 2: Label View
options.file = "./test/label_view/mock.html"
runner(options).then(result => {
  let json = JSON.stringify(result);
  // Optional: dump JSON results
  //console.log(json);
});
