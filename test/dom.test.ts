import { describe, it, expect } from 'vitest';
import { element, appendChildren, replaceChildren } from '../src/components/dom';

describe('element', () => {
  it('should build the requested tag', () => {
    expect(element('span').tagName).toBe('SPAN');
  });

  it('should apply a class name', () => {
    expect(element('div', { className: 'bes-thing' }).className).toBe('bes-thing');
  });

  it('should apply attributes', () => {
    const node = element('button', { attributes: { 'aria-label': 'Play', title: 'Play' } });

    expect(node.getAttribute('aria-label')).toBe('Play');
    expect(node.getAttribute('title')).toBe('Play');
  });

  it('should set inner markup', () => {
    expect(element('div', { html: '<svg></svg>' }).querySelector('svg')).toBeTruthy();
  });

  it('should nest children in the order given', () => {
    const parent = element('div', {
      children: [element('span', { className: 'first' }), element('span', { className: 'second' })]
    });

    expect(Array.from(parent.children).map(child => child.className)).toEqual(['first', 'second']);
  });

  it('should skip children that are absent', () => {
    const parent = element('div', { children: [element('span'), null, element('span')] });

    expect(parent.children.length).toBe(2);
  });

  it('should build nothing beyond the tag when given no spec', () => {
    const node = element('div');

    expect(node.className).toBe('');
    expect(node.children.length).toBe(0);
  });
});

describe('appendChildren', () => {
  it('should add to what is already there', () => {
    const parent = element('div', { children: [element('span', { className: 'existing' })] });

    appendChildren(parent, [element('span', { className: 'added' })]);

    expect(Array.from(parent.children).map(child => child.className)).toEqual(['existing', 'added']);
  });

  it('should ignore absent children', () => {
    const parent = element('div');

    appendChildren(parent, [null, null]);

    expect(parent.children.length).toBe(0);
  });
});

describe('replaceChildren', () => {
  it('should discard what was there before', () => {
    const parent = element('div', { children: [element('span', { className: 'old' })] });

    replaceChildren(parent, element('span', { className: 'new' }));

    expect(Array.from(parent.children).map(child => child.className)).toEqual(['new']);
  });

  it('should empty the parent when given nothing', () => {
    const parent = element('div', { children: [element('span')] });

    replaceChildren(parent);

    expect(parent.children.length).toBe(0);
  });

  it('should skip absent children while replacing', () => {
    const parent = element('div', { children: [element('span', { className: 'old' })] });

    replaceChildren(parent, null, element('span', { className: 'new' }));

    expect(Array.from(parent.children).map(child => child.className)).toEqual(['new']);
  });

  it('should do nothing when there is no parent', () => {
    expect(() => replaceChildren(null, element('span'))).not.toThrow();
  });
});
