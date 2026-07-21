import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import type { EntryContext } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderer = vi.hoisted(() => ({
  abort: vi.fn(),
  options: undefined as RenderToPipeableStreamOptions | undefined,
  pipe: vi.fn(),
}));

vi.mock('react-dom/server', () => ({
  renderToPipeableStream: vi.fn(
    (_children: unknown, options: RenderToPipeableStreamOptions | undefined) => {
      renderer.options = options;
      return { abort: renderer.abort, pipe: renderer.pipe };
    },
  ),
}));

import handleRequest, { streamTimeout } from './entry-server.js';

const entryContext = { isSpaMode: false } as EntryContext;

function startRequest() {
  const response = handleRequest(
    new Request('https://example.com/'),
    200,
    new Headers(),
    entryContext,
  );
  const onShellReady = renderer.options?.onShellReady;

  if (onShellReady === undefined) {
    throw new Error('Expected the renderer to provide onShellReady');
  }

  onShellReady();
  return response;
}

describe('React Router server rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderer.abort.mockReset();
    renderer.options = undefined;
    renderer.pipe.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the abort deadline when streaming finishes', async () => {
    renderer.pipe.mockImplementation((body: NodeJS.EventEmitter) => {
      body.emit('finish');
    });

    await startRequest();
    vi.advanceTimersByTime(streamTimeout + 1_000);

    expect(renderer.abort).not.toHaveBeenCalled();
  });

  it('keeps the abort deadline while streaming is still in progress', async () => {
    await startRequest();
    vi.advanceTimersByTime(streamTimeout + 1_000);

    expect(renderer.abort).toHaveBeenCalledOnce();
  });

  it('clears the abort deadline when the shell fails', async () => {
    const error = new Error('render failed');
    const response = handleRequest(
      new Request('https://example.com/'),
      200,
      new Headers(),
      entryContext,
    );

    renderer.options?.onShellError?.(error);

    await expect(response).rejects.toBe(error);
    vi.advanceTimersByTime(streamTimeout + 1_000);
    expect(renderer.abort).not.toHaveBeenCalled();
  });
});
