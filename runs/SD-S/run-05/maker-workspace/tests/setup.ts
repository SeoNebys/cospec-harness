import "@testing-library/jest-dom/vitest";
process.env.DATABASE_PATH ??= `/tmp/kept-vitest-${process.pid}.db`;
