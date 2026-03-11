import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

// Dispatch a keydown event on window and return it (so callers can assert
// preventDefault was/wasn't called if needed).
function fireKey(key, { keyCode } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode: keyCode ?? key.charCodeAt(0),
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardNavigation', () => {
  // ─── onBack ──────────────────────────────────────────────────────────────

  it('calls onBack when Escape is pressed', () => {
    const onBack = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onBack }));
    fireKey('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onBack for the XF86Back key (TV back button)', () => {
    const onBack = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onBack }));
    fireKey('XF86Back');
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onBack for Samsung Tizen keyCode 10009', () => {
    const onBack = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onBack }));
    fireKey('', { keyCode: 10009 });
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  // ─── onMenu ──────────────────────────────────────────────────────────────

  it('calls onMenu when F1 is pressed', () => {
    const onMenu = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onMenu }));
    fireKey('F1');
    expect(onMenu).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onMenu when ContextMenu is pressed', () => {
    const onMenu = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onMenu }));
    fireKey('ContextMenu');
    expect(onMenu).toHaveBeenCalledTimes(1);
    unmount();
  });

  // ─── onPlay / onPause ────────────────────────────────────────────────────

  it('calls onPause when Space is pressed (toggle path)', () => {
    const onPause = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onPause }));
    fireKey(' ');
    expect(onPause).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onPlay when MediaPlay is pressed', () => {
    const onPlay = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onPlay }));
    fireKey('MediaPlay');
    expect(onPlay).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onPause when MediaPause is pressed', () => {
    const onPause = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onPause }));
    fireKey('MediaPause');
    expect(onPause).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onPause when MediaPlayPause is pressed', () => {
    const onPause = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onPause }));
    fireKey('MediaPlayPause');
    expect(onPause).toHaveBeenCalledTimes(1);
    unmount();
  });

  // ─── no spurious calls ───────────────────────────────────────────────────

  it('does not fire any callback for unrelated keys', () => {
    const onBack = vi.fn();
    const onMenu = vi.fn();
    const onPlay = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardNavigation({ onBack, onMenu, onPlay })
    );
    fireKey('a');
    fireKey('Tab');
    fireKey('F5');
    expect(onBack).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
    unmount();
  });

  // ─── cleanup on unmount ──────────────────────────────────────────────────
  //
  // This is the most important regression to guard against: a leaked listener
  // would fire callbacks in components that are already unmounted.

  it('removes event listeners on unmount so callbacks are no longer invoked', () => {
    const onBack = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ onBack }));
    unmount();
    fireKey('Escape');
    expect(onBack).not.toHaveBeenCalled();
  });

  // ─── missing callbacks ───────────────────────────────────────────────────

  it('does not throw when callbacks are undefined', () => {
    const { unmount } = renderHook(() => useKeyboardNavigation({}));
    expect(() => {
      fireKey('Escape');
      fireKey('F1');
      fireKey(' ');
    }).not.toThrow();
    unmount();
  });
});
