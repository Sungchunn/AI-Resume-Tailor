import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock getBoundingClientRect for popover positioning
Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
  top: 0,
  left: 0,
  bottom: 100,
  right: 100,
  width: 100,
  height: 100,
  x: 0,
  y: 0,
  toJSON: () => {},
});
