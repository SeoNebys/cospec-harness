import '@testing-library/jest-dom/vitest';
import { afterEach,vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
class ResizeObserver { observe(){} unobserve(){} disconnect(){} }
Object.defineProperty(globalThis,'ResizeObserver',{value:ResizeObserver,writable:true});
Object.defineProperty(window,'matchMedia',{value:vi.fn().mockImplementation((query:string)=>({matches:false,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()})),writable:true});
Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:vi.fn(),writable:true});
Object.defineProperty(document,'elementFromPoint',{value:vi.fn(()=>document.body),writable:true});
Object.defineProperty(document,'elementsFromPoint',{value:vi.fn(()=>[document.body]),writable:true});
