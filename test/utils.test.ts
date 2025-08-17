import { describe, it, expect, beforeEach } from 'vitest';
import { createPagedata, createDomNodes, cleanupTestNodes, mockApiResponse } from './utils';

describe('Test Utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createPagedata', () => {
    it('should create pagedata element', () => {
      createPagedata();

      const pagedata = document.getElementById('pagedata');
      expect(pagedata).toBeTruthy();
      expect(pagedata?.getAttribute('data-blob')).toContain('testId');
    });
  });

  describe('createDomNodes', () => {
    it('should create test nodes with content', () => {
      const html = '<div class="test">Hello World</div>';
      const fragment = createDomNodes(html);

      expect(fragment).toBeTruthy();

      const testNodes = document.getElementById('test-nodes');
      expect(testNodes).toBeTruthy();

      const testDiv = testNodes?.querySelector('.test');
      expect(testDiv?.textContent).toBe('Hello World');
    });
  });

  describe('cleanupTestNodes', () => {
    it('should remove test nodes', () => {
      createDomNodes('<div>test</div>');
      expect(document.getElementById('test-nodes')).toBeTruthy();

      cleanupTestNodes();
      expect(document.getElementById('test-nodes')).toBeNull();
    });
  });

  describe('mockApiResponse', () => {
    it('should create a mock Response object', () => {
      const body = { success: true, data: 'test' };
      const response = mockApiResponse(body);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-type')).toBe('application/json');
    });

    it('should work with empty body', () => {
      const response = mockApiResponse();
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });
  });
});
