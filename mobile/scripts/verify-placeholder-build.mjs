import { access } from 'node:fs/promises';

await access(new URL("../index.html", import.meta.url));
console.log("Mobile web entry verified.");
