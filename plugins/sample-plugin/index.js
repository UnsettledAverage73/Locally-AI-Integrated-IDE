function activate(api) {
  api.commands.registerCommand("sample.helloWorld", () => {
    console.log("Hello, World from the sample plugin!");
  });
}

module.exports = {
  activate,
};
