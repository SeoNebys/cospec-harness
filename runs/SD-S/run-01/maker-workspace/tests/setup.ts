// Provide an in-memory IndexedDB so the Dexie-backed data layer runs under jsdom.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
