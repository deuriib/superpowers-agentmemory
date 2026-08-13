import { test, expect } from 'bun:test';
import { parsePlan } from '../../scripts/agentmemory-bridge.mjs';

const SAMPLE = `# Sample Plan

**Goal:** Exercise the plan-sync bridge.

### Task 1: Alpha

- [ ] Implement alpha

### Task 2: Beta

Consumes: Task 1

- [ ] Implement beta on top of alpha

### Task 3: Gamma

Requires: Task 2

- [x] Gamma already done
`;

test('parsePlan extracts tasks with titles and bodies', () => {
  const tasks = parsePlan(SAMPLE);
  expect(tasks).toHaveLength(3);
  expect(tasks[0]).toMatchObject({ index: 1, title: 'Alpha' });
  expect(tasks[1]).toMatchObject({ index: 2, title: 'Beta' });
  expect(tasks[2]).toMatchObject({ index: 3, title: 'Gamma' });
  expect(tasks[2].body).toContain('- [x] Gamma already done');
});

test('parsePlan maps Consumes/Requires references to dependency numbers', () => {
  const tasks = parsePlan(SAMPLE);
  expect(tasks[0].requires).toEqual([]);
  expect(tasks[1].requires).toEqual([1]);
  expect(tasks[2].requires).toEqual([2]);
});

test('parsePlan handles bold bullets and deduplicates dependencies', () => {
  const md = `### Task 1: A

- **Consumes:** Task 2
- **Consumes:** Task 2

### Task 2: B
`;
  const tasks = parsePlan(md);
  expect(tasks[0].requires).toEqual([2]);
});

test('parsePlan ignores mid-line prose but keeps explicit references', () => {
  const md = `### Task 1: A

This task requires Task 2 to be merged first.

Requires: Task 9

### Task 2: B
`;
  const tasks = parsePlan(md);
  expect(tasks[0].requires).toEqual([9]);
});

test('parsePlan ignores h4 headers and returns an empty array without task headers', () => {
  expect(parsePlan('# No tasks here\n\n- [ ] not a task\n')).toEqual([]);
  const md = `### Task 1: A\n\n#### Task 1: Not A Header\n\n### Task 2: B\n`;
  const tasks = parsePlan(md);
  expect(tasks).toHaveLength(2);
  expect(tasks[0].body).toContain('#### Task 1: Not A Header');
});
