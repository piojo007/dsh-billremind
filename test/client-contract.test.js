import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

assert.match(source, /op: 'setAdvance'/, 'client must call the existing setAdvance operation');
assert.match(source, /global: true/, 'global reminder settings must use global=true');
assert.match(source, /confirmDiscard/, 'edit dialog must expose dirty-state close confirmation');
assert.match(source, /const isDirty = \(\) =>/, 'edit dialog must track dirty state');
assert.match(source, /disabled: saving/, 'dialog actions must be disabled while saving');
assert.match(source, /saving \? L\(\)\.saving/, 'save button must show saving state');
assert.match(source, /role: 'dialog'/, 'edit/settings dialogs must be accessible dialogs');
assert.match(source, /function reminderOrigin/, 'card reminder origin must be derived without changing server data');
assert.match(source, /reminderInherited/, 'client must label default-aligned reminder values');
assert.match(source, /reminderCustom/, 'client must label custom reminder values');
assert.match(source, /VERSION_CONFLICT/, 'client must distinguish revision conflicts');
assert.match(source, /expectedRevision: editing\._revision/, 'edit requests must carry the opening revision');
assert.match(source, /onForceSave: forceSave/, 'conflicts must offer an explicit overwrite path');
assert.match(source, /op: 'restore'/, 'delete undo must restore by server token');

console.log('client contract tests: ok');
