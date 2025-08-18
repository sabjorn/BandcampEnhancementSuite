interface InputReturnType {
  wrapper: HTMLDivElement;
  input: HTMLInputElement;
}

interface CreateInputButtonPairOptions {
  inputPrefix?: string;
  inputSuffix?: string;
  inputPlaceholder?: number;
  inputClass?: string;
  inputWrapperClass?: string;
  buttonText?: string;
  buttonChildElement?: HTMLElement;
  buttonClass?: string;
  onButtonClick?: (value: string | number) => void;
}

interface CreateButtonOptions {
  className?: string;
  innerText?: string;
  buttonClicked?: () => void;
}

const creatInput = (
  prefix: string,
  suffix: string,
  placeholder: number,
  inputClass: string,
  wrapperClass: string
): InputReturnType => {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;

  const input = document.createElement('input');
  input.type = 'number';
  input.min = placeholder.toString();
  input.className = inputClass;
  input.placeholder = (Math.ceil(parseFloat(placeholder.toString()) * 100) / 100).toString();

  input.addEventListener('focus', function () {
    if (this.value === this.placeholder) {
      this.value = '';
    }
  });

  input.addEventListener('blur', function () {
    if (this.value < this.min) {
      this.value = '';
    }
  });

  wrapper.appendChild(input);

  if (prefix) {
    wrapper.dataset.prefix = prefix;
  }

  if (suffix) {
    wrapper.dataset.suffix = suffix;
  }

  return { wrapper, input };
};

export function createInputButtonPair(options: CreateInputButtonPairOptions = {}): HTMLDivElement {
  const {
    inputPrefix = '$',
    inputSuffix = '',
    inputPlaceholder = 0.0,
    inputClass = 'currency-input',
    inputWrapperClass = 'currency-input-wrapper',
    buttonText = '',
    buttonChildElement,
    buttonClass = 'one-click-button',
    onButtonClick = () => {}
  } = options;

  const { wrapper, input } = creatInput(inputPrefix, inputSuffix, inputPlaceholder, inputClass, inputWrapperClass);

  const button = document.createElement('button');
  button.className = buttonClass;
  if (buttonChildElement) {
    button.append(buttonChildElement);
  } else {
    button.textContent = buttonText;
  }
  button.onclick = () => {
    if (typeof onButtonClick === 'function') {
      const value = input.value || input.placeholder;
      onButtonClick(value);
    }
  };

  const container = document.createElement('div');

  container.appendChild(wrapper);
  container.appendChild(button);

  return container;
}

export function createButton(
  options: CreateButtonOptions = {}
): HTMLAnchorElement & { disable: () => void; enable: () => void } {
  const { className, innerText, buttonClicked } = options;

  const button = document.createElement('a') as HTMLAnchorElement & { disable: () => void; enable: () => void };
  button.className = className;
  button.innerText = innerText;
  button.addEventListener('click', buttonClicked);

  button.disable = () => {
    button.style.opacity = '0.5';
    button.style.pointerEvents = 'none';
    button.setAttribute('disabled', 'true');
  };

  button.enable = () => {
    button.style.opacity = '';
    button.style.pointerEvents = '';
    button.removeAttribute('disabled');
  };

  return button;
}
