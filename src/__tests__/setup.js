import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom's DOM matchers (toBeInTheDocument, etc.)
// We don't use globals: true, so we wire this up explicitly.
expect.extend(matchers);
