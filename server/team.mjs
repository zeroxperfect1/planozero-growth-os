import { readFileSync, existsSync } from 'node:fs';
const file = (name) => new URL(name, import.meta.url);
// The repo ships example accounts; the real team stays in an ignored private file.
export const team = JSON.parse(
  readFileSync(existsSync(file('./team.private.json')) ? file('./team.private.json') : file('./team.json'), 'utf8'),
);
