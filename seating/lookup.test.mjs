import test from 'node:test';
import assert from 'node:assert/strict';
import { seatingResponse, requestSeating } from './app.js';

test('seating response discards invitation credentials and private RSVP fields', () => {
  const safe = seatingResponse({schemaVersion:2,state:'ready',guest:{displayName:'Example Guest',token:'private-token'},rsvp:{privateNote:'Private'},tableCheck:{state:'available',assignment:{name:'Table 08',guest_id:'private-id'}}});
  assert.deepEqual(safe,{schemaVersion:2,state:'ready',guest:{displayName:'Example Guest'},tableCheck:{state:'available',assignment:{name:'Table 08'}}});
  assert.doesNotMatch(JSON.stringify(safe),/private/);
});
test('locked and missing assignment states cannot show a supplied table', () => {
  assert.deepEqual(seatingResponse({schemaVersion:2,state:'locked',tableCheck:{state:'available',assignment:{name:'Private table'}}}),{schemaVersion:2,state:'locked'});
  assert.deepEqual(seatingResponse({schemaVersion:2,state:'ready',guest:{displayName:'Example'},tableCheck:{state:'available',assignment:{name:''}}}),{schemaVersion:2,state:'temporary_error'});
});
test('requests put credentials only in POST body and suppress cookies and referrers', async () => {
  let seen;
  const result = await requestSeating({action:'invitation',token:'abc123'},{url:'https://example.test/api',fetchImpl:async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({schemaVersion:2,state:'disabled'})};}});
  assert.equal(seen.url,'https://example.test/api');
  assert.equal(seen.options.method,'POST');
  assert.equal(seen.options.credentials,'omit');
  assert.equal(seen.options.referrerPolicy,'no-referrer');
  assert.equal(JSON.parse(seen.options.body).token,'abc123');
  assert.equal(result.state,'disabled');
});
test('network and invalid API responses fail visibly', async () => {
  for (const fetchImpl of [async()=>{throw new Error('offline');},async()=>({ok:true,json:async()=>({state:'ready'})})]) {
    const result = await requestSeating({action:'table_lookup',name:'Example Guest'},{url:'https://example.test/api',fetchImpl});
    assert.equal(result.state,'temporary_error');
  }
});
