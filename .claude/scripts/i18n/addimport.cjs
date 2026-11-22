// usage: node addimport.cjs <file> <name> <from>   (adds a named import, sorted among @/ imports)
const fs = require('node:fs');
const { addImport } = require('./lib.cjs');
const [file, name, from] = process.argv.slice(2);
fs.writeFileSync(file, addImport(fs.readFileSync(file, 'utf8'), name, from));
