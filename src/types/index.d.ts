import * as dom from '@violentmonkey/dom';
import * as ui from '@violentmonkey/ui';

declare global {
  const VM: typeof dom & typeof ui;
  const GM: any;
  const unsafeWindow: Window & typeof globalThis;
  namespace JSX {
    /**
     * JSX.Element can be different based on pragma in babel config:
     * - VNode   - when jsxFactory is VM.h
     * - DomNode - when jsxFactory is VM.hm
     */
    type Element = import('@gera2ld/jsx-dom').VNode;
  }
}
