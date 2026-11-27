import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.mjs';
import { TOKEN_A, TOKEN_B } from './fixtures.mjs';

const lookup = (h, name = '测试宾客 A') => h.post({action:'table_lookup', name});
function openHarness(options = {}) {
  const h = createHarness(options);
  h.setSetting('public_table_lookup_enabled', 'yes');
  h.setSetting('table_check_mode', 'force_open');
  return h;
}
function assertMinimal(response) {
  const keys = Object.keys(response).sort();
  if (response.state === 'ready') {
    assert.deepEqual(keys, ['guest', 'schemaVersion', 'state', 'tableCheck']);
    assert.deepEqual(Object.keys(response.guest), ['displayName']);
    if (response.tableCheck.state === 'available') {
      assert.deepEqual(Object.keys(response.tableCheck).sort(), ['assignment', 'state']);
      assert.deepEqual(Object.keys(response.tableCheck.assignment), ['name']);
    } else assert.deepEqual(response.tableCheck, {state:'assignment_pending'});
  } else assert.deepEqual(keys, ['schemaVersion', 'state']);
  const wire = JSON.stringify(response);
  for (const value of [TOKEN_A, TOKEN_B, 'guest-0001', 'guest-0002', 'SECRET_TABLE', 'PERSONAL_SECRET', 'SETTINGS_SECRET', 'privateNote', 'partySize']) {
    assert.equal(wire.includes(value), false, `Response leaked ${value}`);
  }
}

test('public lookup is disabled unless explicitly enabled and does not read Guests', () => {
  const h = createHarness();
  h.setSetting('table_check_mode', 'force_open');
  for (const setting of ['', 'no', 'true', '1']) {
    h.setSetting('public_table_lookup_enabled', setting);
    const result = lookup(h);
    assert.deepEqual(result, {schemaVersion:2, state:'disabled'});
    assertMinimal(result);
  }
  assert.equal(h.stats.reads.includes('Guests'), false);
  assert.equal(h.stats.writes.length, 0);
});

test('an exact matching invitation returns only its display name and table without writing data', () => {
  const h = openHarness();
  const before = JSON.stringify(h.data);
  const result = lookup(h);
  assert.deepEqual(result, {
    schemaVersion:2, state:'ready', guest:{displayName:'测试宾客 A'},
    tableCheck:{state:'available', assignment:{name:'测试桌位 A'}}
  });
  assertMinimal(result);
  assert.deepEqual([...new Set(h.stats.reads)].sort(), ['Guests', 'Settings', 'Tables']);
  assert.equal(h.stats.writes.length, 0);
  assert.equal(JSON.stringify(h.data), before);
});

test('lookup normalizes case, full-width Latin text and repeated whitespace without partial matching', () => {
  const h = openHarness();
  h.setCell('Guests', 1, 'guest_name', 'Ｌｏｕｉｓ　Ｎｇ');
  assert.equal(lookup(h, '  louis   NG  ').state, 'ready');
  assert.equal(lookup(h, 'Louis').state, 'not_found');
  assert.equal(lookup(h, 'Ng').state, 'not_found');
  h.setCell('Guests', 1, 'guest_name', '陈小明');
  assert.equal(lookup(h, '陈小明').state, 'ready');
  assert.equal(lookup(h, '陈小').state, 'not_found');
});

test('optional full-name aliases match without becoming public response fields', () => {
  const h = openHarness();
  h.data.Guests[0].push('search_aliases');
  h.data.Guests[1].push('陈小明;Tan Xiao Ming\n阿明一家|ＣＨＡＮ ＸＩＡＯ ＭＩＮＧ');
  for (const name of ['陈小明', '  tan  xiao ming ', '阿明一家', 'chan xiao ming']) {
    const result = lookup(h, name);
    assert.equal(result.state, 'ready');
    assert.equal(result.guest.displayName, '测试宾客 A');
    assertMinimal(result);
  }
  assert.equal(lookup(h, '阿明').state, 'not_found');
});

test('ambiguous exact names and duplicate aliases never pick a first table', () => {
  const h = openHarness();
  h.setCell('Guests', 2, 'guest_name', '测试宾客 A');
  assert.deepEqual(lookup(h), {schemaVersion:2, state:'ambiguous'});
  h.setCell('Guests', 2, 'guest_name', '测试宾客 B');
  h.data.Guests[0].push('search_aliases');
  h.data.Guests[1].push('Shared Name');
  h.data.Guests[2].push('SHARED NAME');
  const result = lookup(h, 'Shared Name');
  assert.equal(result.state, 'ambiguous');
  assertMinimal(result);
  assert.equal(h.stats.reads.includes('Tables'), false);
});

test('invalid or wildcard queries are rejected before reading any Sheet', () => {
  const h = openHarness();
  for (const name of [undefined, null, 42, {}, [], '', ' ', 'A', '王', '*', '测试*', '测试?', '测试%', '测试_', '[测试]', '<测试>', '\\测试', '测试\u0000', '测试\n宾客', '0'.repeat(3), '名'.repeat(121)]) {
    const result = h.post({action:'table_lookup', name});
    assert.equal(result.state, 'invalid_query', JSON.stringify(name));
    assertMinimal(result);
  }
  assert.deepEqual(h.stats.reads, []);
  assert.equal(h.stats.writes.length, 0);
});

test('lookup rejects extra request fields rather than accepting credential or guest ID selectors', () => {
  const h = openHarness();
  for (const extra of [{token:TOKEN_A}, {guest_id:'guest-0002'}, {table_id:'SECRET_TABLE_B'}, {names:['测试宾客 A']}]) {
    const result = h.post({action:'table_lookup', name:'测试宾客 A', ...extra});
    assert.equal(result.state, 'invalid_query');
    assertMinimal(result);
  }
  assert.deepEqual(h.stats.reads, []);
});

test('both scheduled and forced closure prevent name enumeration', () => {
  const h = openHarness();
  h.setSetting('table_check_mode', 'scheduled');
  for (const name of ['测试宾客 A', 'Unknown Guest']) {
    assert.deepEqual(lookup(h, name), {schemaVersion:2, state:'locked'});
  }
  h.setSetting('table_check_mode', 'force_closed');
  assert.deepEqual(lookup(h), {schemaVersion:2, state:'locked'});
  assert.equal(h.stats.reads.includes('Guests'), false);
  assert.equal(h.stats.reads.includes('Tables'), false);
});

test('scheduled lookup opens at Malaysia midnight and malformed release settings fail closed', () => {
  const h = openHarness();
  h.setSetting('table_check_mode', 'scheduled');
  assert.equal(lookup(h).state, 'locked');
  h.control.now = '2026-11-27T16:00:00.000Z';
  assert.equal(lookup(h).state, 'ready');
  h.setSetting('table_release_date', 'not a date');
  assert.deepEqual(lookup(h), {schemaVersion:2, state:'temporary_error'});
});

test('inactive, revoked, expired and uncredentialed rows are invisible to lookup', () => {
  const cases = [
    ['invitation_status', 'disabled'], ['invitation_status', 'revoked'], ['invitation_status', 'unknown'],
    ['revoked', 'YES'], ['expires_at', '2026-11-27T15:59:59.000Z'], ['expires_at', 'bad date'],
    ['guest_id', ''], ['token', ''], ['token', 'not-a-token']
  ];
  for (const [key, value] of cases) {
    const h = openHarness();
    h.setCell('Guests', 1, key, value);
    const result = lookup(h);
    assert.equal(result.state, 'not_found', `${key}=${value}`);
    assertMinimal(result);
    assert.equal(h.stats.reads.includes('Tables'), false);
  }
});

test('duplicate internal IDs or credentials fail closed regardless of row order', () => {
  for (const field of ['guest_id', 'token']) {
    const h = openHarness();
    h.setCell('Guests', 2, field, field === 'guest_id' ? 'guest-0001' : TOKEN_A);
    assert.equal(lookup(h).state, 'not_found');
    h.data.Guests = [h.data.Guests[0], ...h.data.Guests.slice(1).reverse()];
    assert.equal(lookup(h).state, 'not_found');
    assert.equal(h.stats.reads.includes('Tables'), false);
  }
});

test('an inactive duplicate name does not block the one valid invitation', () => {
  const h = openHarness();
  h.setCell('Guests', 2, 'guest_name', '测试宾客 A');
  h.setCell('Guests', 2, 'invitation_status', 'revoked');
  const result = lookup(h);
  assert.equal(result.state, 'ready');
  assert.equal(result.tableCheck.assignment.name, '测试桌位 A');
});

test('unassigned tables remain pending and duplicate table definitions are temporary errors', () => {
  const h = openHarness();
  h.setCell('Guests', 1, 'table_id', '');
  assert.deepEqual(lookup(h).tableCheck, {state:'assignment_pending'});
  h.setCell('Guests', 1, 'table_id', 'SECRET_TABLE_A');
  h.data.Tables.push(['SECRET_TABLE_A', 'Wrong table', 'INTERNAL']);
  assert.deepEqual(lookup(h), {schemaVersion:2, state:'temporary_error'});
});

test('manual table changes are reflected on the next lookup', () => {
  const h = openHarness();
  assert.equal(lookup(h).tableCheck.assignment.name, '测试桌位 A');
  h.setCell('Guests', 1, 'table_id', 'SECRET_TABLE_B');
  assert.equal(lookup(h).tableCheck.assignment.name, '测试桌位 B');
  assert.equal(h.stats.writes.length, 0);
});

test('lookup failures expose no exception details or other guest data', () => {
  const h = openHarness();
  h.control.failRead = true;
  const result = lookup(h);
  assert.deepEqual(result, {schemaVersion:2, state:'temporary_error'});
  assertMinimal(result);
});

test('public lookup opt-in does not change token-authorized invitation behavior', () => {
  const h = openHarness();
  h.setSetting('public_table_lookup_enabled', 'no');
  assert.equal(lookup(h).state, 'disabled');
  const invitation = h.post({action:'invitation', token:TOKEN_A});
  assert.equal(invitation.state, 'ready');
  assert.equal(invitation.tableCheck.assignment.name, '测试桌位 A');
  assert.equal(h.stats.writes.length, 0);
});
