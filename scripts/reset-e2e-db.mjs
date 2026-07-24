import { rm } from "node:fs/promises";

const paths = [
  ".data/playwright.sqlite",
  ".data/playwright.sqlite-shm",
  ".data/playwright.sqlite-wal",
];

await Promise.all(paths.map((path) => rm(path, { force: true })));
