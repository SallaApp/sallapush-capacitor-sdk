/** The example's small DOM helpers: it uses no UI framework. */

type Child = Node | string;

/** An element of `tag` with a class and children. */
export function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className: string,
  ...children: Child[]
): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

export function section(title: string, ...children: Child[]): HTMLElement {
  return element(
    'section',
    'section',
    element('h2', 'section-title', title),
    ...children
  );
}

export function row(...children: Child[]): HTMLElement {
  return element('div', 'row', ...children);
}

export function button(title: string, onPress: () => void): HTMLButtonElement {
  const node = element('button', 'button', title);
  node.type = 'button';
  node.addEventListener('click', () => onPress());
  return node;
}

/** A text field labelled by its placeholder; read it with `.value`. */
export function textInput(
  label: string,
  {
    secure = false,
    numeric = false,
  }: { secure?: boolean; numeric?: boolean } = {}
): HTMLInputElement {
  const node = element('input', 'field');
  node.type = secure ? 'password' : 'text';
  node.inputMode = numeric ? 'numeric' : 'text';
  node.placeholder = label;
  node.autocapitalize = 'none';
  node.autocomplete = 'off';
  node.spellcheck = false;
  node.setAttribute('aria-label', label);
  return node;
}

export function toggle(
  label: string,
  value: boolean,
  onChange: (value: boolean) => void
): HTMLElement {
  const input = element('input', 'switch');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return element('label', 'toggle', element('span', 'text', label), input);
}

/** One of `options`, as a native picker. */
export function select<Option extends string>(
  options: readonly Option[],
  value: Option,
  onChange: (option: Option) => void
): HTMLSelectElement {
  const node = element(
    'select',
    'select',
    ...options.map((option) => {
      const item = element('option', '', option);
      item.value = option;
      return item;
    })
  );
  node.value = value;
  node.addEventListener('change', () => {
    const chosen = options.find((option) => option === node.value);
    if (chosen !== undefined) {
      onChange(chosen);
    }
  });
  return node;
}

/** A read-only value with its label: "Label: value". */
export function output(label: string, value: string): HTMLElement {
  return element('p', 'line', element('span', 'label', `${label}: `), value);
}

export function note(text: string): HTMLElement {
  return element('p', 'note', text);
}
