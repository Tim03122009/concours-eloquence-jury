#!/usr/bin/env node
/**
 * Lance la suite de tests automatiques du projet (Jest dans test/).
 * Usage : node run-tests.js
 * Prérequis : cd test && npm install (une fois)
 */
const path = require('path');
const { execSync } = require('child_process');

const testDir = path.join(__dirname, 'test');
try {
  execSync('npm test -- --verbose', {
    cwd: testDir,
    stdio: 'inherit'
  });
} catch (e) {
  process.exit(e.status || 1);
}
