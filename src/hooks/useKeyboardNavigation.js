import { useEffect } from 'react';

/**
 * Hook for handling TV remote control and keyboard navigation
 * Supports standard TV remote keys and keyboard fallbacks
 */
export function useKeyboardNavigation({ onMenu, onBack, onPlay, onPause }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Prevent default for navigation keys
      const navigationKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Enter', ' ', 'Escape', 'Backspace'
      ];

      if (navigationKeys.includes(event.key)) {
        // Only prevent default if not in an input field
        if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') {
          event.preventDefault();
        }
      }

      // Handle menu/settings key
      // Common TV remote keys: 461 (Back), 1001 (Menu), 403 (Red), 404 (Green)
      if (
        event.key === 'F1' ||
        event.key === 'ContextMenu' ||
        event.keyCode === 1001 ||
        event.keyCode === 18 // Alt key as menu fallback
      ) {
        event.preventDefault();
        if (onMenu) onMenu();
        return;
      }

      // Handle back/return key
      if (
        event.key === 'Escape' ||
        event.key === 'XF86Back' ||
        event.keyCode === 461 ||
        event.keyCode === 10009 // Samsung back button
      ) {
        if (onBack) onBack();
        return;
      }

      // Handle play/pause
      if (
        event.key === ' ' ||
        event.key === 'MediaPlayPause' ||
        event.key === 'MediaPlay' ||
        event.key === 'MediaPause'
      ) {
        if (event.key === 'MediaPlay' && onPlay) {
          onPlay();
        } else if (event.key === 'MediaPause' && onPause) {
          onPause();
        } else if (onPlay || onPause) {
          // Toggle between play and pause
          if (onPause) onPause();
          else if (onPlay) onPlay();
        }
        return;
      }
    };

    // Handle specific TV platform keys
    const handleTVKey = (event) => {
      // LG webOS TV key events
      if (window.webOS) {
        switch (event.keyCode) {
          case 461: // Back
            if (onBack) onBack();
            break;
          case 1001: // Menu
            if (onMenu) onMenu();
            break;
          default:
            break;
        }
      }

      // Samsung Tizen TV key events
      if (window.tizen) {
        try {
          const key = event.keyName;
          switch (key) {
            case 'Back':
            case 'Return':
              if (onBack) onBack();
              break;
            case 'Menu':
            case 'Tools':
              if (onMenu) onMenu();
              break;
            default:
              break;
          }
        } catch (error) {
          console.error('Error handling Tizen key:', error);
        }
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleTVKey);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleTVKey);
    };
  }, [onMenu, onBack, onPlay, onPause]);
}

/**
 * Hook for handling spatial navigation (arrow keys)
 * Useful for grid-based navigation in settings
 */
export function useSpatialNavigation(containerRef, options = {}) {
  const {
    onNavigate,
    onSelect,
    selector = '.focusable',
    initialFocus = 0
  } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(selector);

    if (focusableElements.length === 0) return;

    // Set initial focus
    if (focusableElements[initialFocus]) {
      focusableElements[initialFocus].focus();
    }

    const handleKeyDown = (event) => {
      const currentElement = document.activeElement;
      const currentIndex = Array.from(focusableElements).indexOf(currentElement);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      let handled = false;

      switch (event.key) {
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + 1, focusableElements.length - 1);
          handled = true;
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 1, 0);
          handled = true;
          break;
        case 'ArrowRight':
          // Can be customized for grid navigation
          nextIndex = Math.min(currentIndex + 1, focusableElements.length - 1);
          handled = true;
          break;
        case 'ArrowLeft':
          // Can be customized for grid navigation
          nextIndex = Math.max(currentIndex - 1, 0);
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (onSelect) {
            onSelect(currentElement, currentIndex);
            handled = true;
          }
          break;
        default:
          break;
      }

      if (handled) {
        event.preventDefault();
        if (nextIndex !== currentIndex && focusableElements[nextIndex]) {
          focusableElements[nextIndex].focus();
          if (onNavigate) {
            onNavigate(focusableElements[nextIndex], nextIndex);
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, onNavigate, onSelect, selector, initialFocus]);
}
