import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const pluginPath = process.argv[2];

if (!pluginPath) {
  console.error('Usage: node test-agent-registration.mjs PLUGIN_PATH');
  process.exit(2);
}

const agentsDir = path.resolve('.opencode/agents');
const mdFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
const expectedCount = mdFiles.length;

// Read montilla.md to find its expected mode value
const montillaContent = fs.readFileSync(path.join(agentsDir, 'montilla.md'), 'utf8');
const montillaModeMatch = montillaContent.match(/^mode:\s*(.+)$/m);
const expectedMontillaMode = montillaModeMatch ? montillaModeMatch[1].trim() : 'unknown';

// Import and invoke plugin
const mod = await import(pathToFileURL(pluginPath).href);
const plugin = await mod.SuperpowersPlugin({ client: {}, directory: '.' });

// --- TEST SUITE 1: Basic Registration ---
const config1 = { skills: {}, agent: { vasquez: { mode: 'primary', prompt: 'KEEP ME' } } };
await plugin.config(config1);

const failures = [];

// Test 1: All agents registered (expectedCount - 1 because vasquez is pre-seeded and skipped)
const registeredCount = Object.keys(config1.agent).length;
const expectedTotal = expectedCount; // vasquez seeded + (expectedCount - 1) from md files = expectedCount
if (registeredCount !== expectedTotal) {
  failures.push(`Test 1 FAIL: expected ${expectedTotal} agents registered, got ${registeredCount}`);
}

// Test 2: montilla exists and its mode matches
if (!config1.agent.montilla) {
  failures.push('Test 2 FAIL: montilla agent not registered');
} else if (config1.agent.montilla.mode !== expectedMontillaMode) {
  failures.push(`Test 2 FAIL: montilla mode expected "${expectedMontillaMode}", got "${config1.agent.montilla.mode}"`);
}

// Test 3: Nested permission block is an object, NOT a string
if (!config1.agent.montilla) {
  failures.push('Test 3 SKIP: montilla not registered');
} else {
  const perm = config1.agent.montilla.permission;
  if (typeof perm !== 'object' || perm === null) {
    failures.push(`Test 3 FAIL: montilla.permission should be an object, got ${typeof perm}`);
  } else if (typeof perm.task !== 'object') {
    failures.push(`Test 3 FAIL: montilla.permission.task should be an object (nested block), got ${typeof perm.task}`);
  } else if (perm.task.vasquez !== 'allow') {
    failures.push(`Test 3 FAIL: montilla.permission.task.vasquez expected "allow", got "${perm.task.vasquez}"`);
  }
}

// Test 4: prompt contains body WITHOUT frontmatter
if (!config1.agent.backend) {
  failures.push('Test 4 FAIL: backend agent not registered');
} else {
  const prompt = config1.agent.backend.prompt || '';
  if (!prompt.includes('craftsman of the backend')) {
    failures.push('Test 4 FAIL: backend prompt missing distinctive body phrase "craftsman of the backend"');
  }
  if (prompt.startsWith('---')) {
    failures.push('Test 4 FAIL: backend prompt starts with "---" (frontmatter delimiter not stripped)');
  }
  // Body should NOT contain frontmatter description text
  if (prompt.includes('Backend implementer')) {
    failures.push('Test 4 FAIL: backend prompt contains frontmatter description text');
  }
}

// Test 5: explore agent has deeply nested permission (2 levels)
if (!config1.agent.explore) {
  failures.push('Test 5 FAIL: explore agent not registered');
} else {
  const perm = config1.agent.explore.permission;
  if (typeof perm !== 'object' || perm === null) {
    failures.push(`Test 5 FAIL: explore.permission should be an object, got ${typeof perm}`);
  } else {
    // explore has permission["*"]: deny, and bash: { "*": deny, "git log *": allow }
    if (perm['*'] !== 'deny') {
      failures.push(`Test 5 FAIL: explore.permission["*"] expected "deny", got "${perm['*']}"`);
    }
    if (typeof perm.bash !== 'object') {
      failures.push(`Test 5 FAIL: explore.permission.bash should be an object, got ${typeof perm.bash}`);
    } else if (perm.bash['*'] !== 'deny') {
      failures.push(`Test 5 FAIL: explore.permission.bash["*"] expected "deny", got "${perm.bash['*']}"`);
    }
  }
}

// Test 6: Idempotency - invoke hook again on same config
const keysBefore = Object.keys(config1.agent).sort();
await plugin.config(config1);
const keysAfter = Object.keys(config1.agent).sort();
const sameKeys = JSON.stringify(keysBefore) === JSON.stringify(keysAfter);
if (!sameKeys) {
  failures.push('Test 6 FAIL: second invocation changed agent keys (not idempotent)');
}
// Also check vasquez preserved
if (config1.agent.vasquez?.prompt !== 'KEEP ME') {
  failures.push('Test 6 FAIL: vasquez prompt corrupted after second invocation');
}

// Test 7: Pre-existing agent NOT overwritten
if (config1.agent.vasquez?.mode !== 'primary') {
  failures.push('Test 7 FAIL: vasquez seeded mode was overwritten');
}
if (config1.agent.vasquez?.prompt !== 'KEEP ME') {
  failures.push('Test 7 FAIL: vasquez seeded prompt was overwritten');
}

// --- REPORT ---
if (failures.length > 0) {
  console.error(JSON.stringify({ registeredCount, expectedTotal, montillaMode: config1.agent.montilla?.mode }, null, 2));
  for (const f of failures) {
    console.error(f);
  }
  process.exit(1);
}

console.log(JSON.stringify({
  registeredCount,
  expectedTotal,
  montillaMode: config1.agent.montilla?.mode,
  montillaPermissionType: typeof config1.agent.montilla?.permission,
  vasquezPreserved: config1.agent.vasquez?.prompt === 'KEEP ME',
}, null, 2));
