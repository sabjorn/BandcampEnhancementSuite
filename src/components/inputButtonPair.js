const creatInput = (prefix, suffix, placeholder, inputClass, wrapperClass) => {
  const wrapper = document.createElement("div");
  wrapper.className = wrapperClass;

  const input = document.createElement("input");
  input.type = "number";
  input.min = placeholder;
  input.value = placeholder;
  input.className = inputClass;
  input.placeholder = placeholder;

  wrapper.appendChild(input);

  if (prefix) {
    wrapper.dataset.prefix = prefix;
  }

  if (suffix) {
    wrapper.dataset.suffix = suffix;
  }

  return { wrapper, input };
};

export function createInputButtonPair(options = {}) {
  const {
    inputPrefix = "$",
    inputSuffix = "",
    inputPlaceholder = 0.0,
    inputClass = "currency-input",
    inputWrapperClass = "currency-input-wrapper",
    buttonText = "+",
    buttonClass = "one-click-button",
    onButtonClick = () => {},
    tralbumDetails = {}
  } = options;

  const { wrapper, input } = creatInput(
    inputPrefix,
    inputSuffix,
    inputPlaceholder,
    inputClass,
    inputWrapperClass
  );

  const button = document.createElement("button");
  button.className = buttonClass;
  button.textContent = buttonText;
  button.onclick = () => {
    if (typeof onButtonClick === "function") {
      onButtonClick(input.value, inputPlaceholder, tralbumDetails);
    }
  };

  const container = document.createElement("div");

  container.appendChild(wrapper);
  container.appendChild(button);

  return container;
}
