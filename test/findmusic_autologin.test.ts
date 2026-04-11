import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

const mockSendMessage = vi.fn();

Object.assign(global, {
  chrome: {
    runtime: {
      sendMessage: mockSendMessage
    }
  }
});

describe('FindMusic Auto-login', () => {
  it('should inject login button on guide page with proper styling', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/guide', href: '' }
    });

    mockSendMessage.mockImplementation((message: any) => {
      if (message.contentScriptQuery === 'checkFindMusicPermissions') {
        return Promise.resolve({ granted: true });
      }
      return Promise.resolve({});
    });

    document.body.innerHTML = `
      <div class="MuiContainer-root MuiContainer-maxWidthMd">
        <div class="MuiBox-root css-14jdev5">Header</div>
        <div class="other-content">Remove me</div>
      </div>
    `;

    await import('../src/findmusic_autologin');

    await vi.waitFor(() => {
      const button = document.getElementById('bes-findmusic-login-button');
      expect(button).toBeTruthy();
    });

    const buttonText = document.querySelector('#bes-findmusic-login-button p');
    expect(buttonText?.textContent).toBe('Login with Bandcamp Enhancement Suite');

    const otherContent = document.querySelector('.other-content');
    expect(otherContent).toBeNull();

    const container = document.querySelector('.MuiContainer-root.MuiContainer-maxWidthMd');
    const buttonContainer = container?.children[1] as HTMLElement;
    expect(buttonContainer?.style.display).toBe('flex');
    expect(buttonContainer?.style.justifyContent).toBe('center');

    const header = container?.firstElementChild;
    expect(header?.textContent).toBe('Header');
  });

  it('should call chrome runtime sendMessage on button click', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/guide', href: '' }
    });

    mockSendMessage.mockImplementation((message: any) => {
      if (message.contentScriptQuery === 'checkFindMusicPermissions') {
        return Promise.resolve({ granted: true });
      }
      if (message.contentScriptQuery === 'autoLoginFindMusic') {
        return Promise.resolve({ success: true, token: 'test-token' });
      }
    });

    document.body.innerHTML = `
      <div class="MuiContainer-root MuiContainer-maxWidthMd">
        <div class="MuiBox-root css-14jdev5">Header</div>
      </div>
    `;

    await import('../src/findmusic_autologin');

    await vi.waitFor(() => {
      const button = document.getElementById('bes-findmusic-login-button');
      expect(button).toBeTruthy();
    });

    const button = document.getElementById('bes-findmusic-login-button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({
        contentScriptQuery: 'checkFindMusicPermissions'
      });
    });

    await vi.waitFor(() => {
      expect(window.location.href).toContain('login?bes_token=test-token');
    });
  });

  it('should not inject login button when permissions are not granted', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/guide', href: '' }
    });

    mockSendMessage.mockImplementation((message: any) => {
      if (message.contentScriptQuery === 'checkFindMusicPermissions') {
        return Promise.resolve({ granted: false });
      }
      return Promise.resolve({});
    });

    document.body.innerHTML = `
      <div class="MuiContainer-root MuiContainer-maxWidthMd">
        <div class="MuiBox-root css-14jdev5">Header</div>
        <div class="other-content">Should not be removed</div>
      </div>
    `;

    await import('../src/findmusic_autologin');

    await new Promise(resolve => setTimeout(resolve, 100));

    const button = document.getElementById('bes-findmusic-login-button');
    expect(button).toBeNull();

    const otherContent = document.querySelector('.other-content');
    expect(otherContent).toBeTruthy();
    expect(otherContent?.textContent).toBe('Should not be removed');
  });
});
