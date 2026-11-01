// Preact + hooks + htm in one ES module, so the app runs with no build step.
export {
  html, render, h, useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect,
} from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
