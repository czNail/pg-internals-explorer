import test from 'node:test';
import assert from 'node:assert/strict';
import {mapSizes,modules,nestedObjects,actors,positions,routes,workloads,overviewState} from '../assets/overview.mjs';
import {labs,labState} from '../assets/labs.mjs';

test('events have an executing actor, valid endpoints, and inspectable objects',()=>{
  for (const workload of Object.values(workloads)) {
    for (const event of workload.steps) {
      assert.ok(actors[event.actor],event.title);
      for (const id of event.targets) assert.ok(modules[id],id);
      for (const transfer of event.flows) {
        const route=routes[transfer.route];
        assert.ok(route&&modules[route.from]&&modules[route.to],event.title);
        assert.ok(transfer.id&&transfer.label);
      }
    }
  }
  for (const info of [...Object.values(modules),...Object.values(nestedObjects)]) assert.ok(labs[info.lab]);
  assert.equal(nestedObjects.page.parent,'buffers');
  assert.equal(nestedObjects.snapshot.parent,'backend');
});

test('requests and returned results have opposite directions and distinct types',()=>{
  assert.deepEqual([routes.sqlRequest.from,routes.sqlRequest.to,routes.sqlRequest.kind],['client','backend','request']);
  assert.deepEqual([routes.sqlResponse.from,routes.sqlResponse.to,routes.sqlResponse.kind],['backend','client','response']);
  const routesInHit=workloads.hit.steps.flatMap(event=>event.flows.map(flow=>flow.route));
  assert.ok(!routesInHit.includes('readCommand')&&!routesInHit.includes('pageRead'));
  const returned=workloads.hit.steps.filter(event=>event.flows.some(flow=>flow.id==='R1'));
  assert.equal(returned.length,2,'the visible value and returned row retain their result identity');
  assert.ok(Object.values(routes).every(route=>route.from!=='page'&&route.to!=='page'),'the page is contained in the pool');
});

test('both layouts contain every component and define every route',()=>{
  for (const [layout,[width,height]] of Object.entries(mapSizes)) {
    for (const id of Object.keys(modules)) {
      const [x,y,w,h]=positions[id][layout];
      assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,id);
    }
    for (const route of Object.values(routes)) assert.match(route[layout],/^M.+ C/);
  }
});

test('commit acknowledgement leaves the data page dirty and its file version old',()=>{
  const write=workloads.write;
  const state=overviewState(write,write.steps.length-1);
  assert.match(state.client,/提交成功/);
  assert.equal(state.flushed,'0/260');
  assert.equal(state.dirty,true);
  assert.equal(state.diskWritten,'0/200');
  assert.deepEqual(state.walRecords.map(record=>record[0]),['W1','W2']);
});

test('background write respects the WAL boundary and file sync is separate',()=>{
  const workload=workloads.background;
  const before=overviewState(workload,1);
  assert.equal(before.dirty,true);
  assert.ok(parseInt(before.flushed.split('/')[1],16)>=parseInt(before.pageLsn.split('/')[1],16));
  const written=overviewState(workload,2);
  assert.equal(written.dirty,false);
  assert.equal(written.diskWritten,'0/220');
  assert.equal(written.diskDurable,'0/200');
  assert.equal(workload.steps[2].actor,'bgwriter');
  assert.equal(workload.steps[3].actor,'checkpointer');
  assert.equal(overviewState(workload,3).diskDurable,'0/220');
});

test('the WAL lab can rewind across the file-write boundary',()=>{
  const lab=labs.wal;
  const committed=labState(lab,3);
  assert.equal(committed.tx,'提交成功');
  assert.equal(committed.flushed,committed.inserted);
  assert.equal(committed.dirty,true);
  const written=labState(lab,4);
  assert.equal(written.dirty,false);
  assert.notEqual(written.written,written.durable);
  assert.deepEqual(labState(lab,3),committed);
});
