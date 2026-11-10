import test from 'node:test';
import assert from 'node:assert/strict';
import {modules, routes, workloads, overviewState} from '../assets/overview.mjs';
import {labs, labState} from '../assets/labs.mjs';

test('overview events point to visible routes and module states', () => {
  for (const workload of Object.values(workloads)) {
    for (const id of Object.keys(modules)) assert.ok(workload.initial[id], id);
    for (const event of workload.steps) {
      const route = routes[event.via];
      assert.ok(route && modules[route.from] && modules[route.to], event.title);
      for (const id of Object.keys(event.updates)) assert.ok(modules[id], id);
    }
  }
  for (const module of Object.values(modules)) assert.ok(labs[module.lab]);
});

test('commit acknowledgement, data page write, and file sync remain distinct', () => {
  const wal = labs.wal;
  const commit = labState(wal, 3);
  assert.equal(commit.tx, '提交成功');
  assert.equal(commit.flushed, commit.inserted);
  assert.equal(commit.dirty, true);
  assert.notEqual(commit.buffer, commit.written);
  const write = labState(wal, 4);
  assert.equal(write.dirty, false);
  assert.equal(write.written, write.buffer);
  assert.notEqual(write.written, write.durable);
  assert.equal(labState(wal, 5).durable, write.written);
  assert.deepEqual(labState(wal, 3), commit, 'rewinding restores the pre-write state');
});

test('write workload acknowledges commit while the data page remains dirty', () => {
  const state = overviewState(workloads.write, workloads.write.steps.length - 1);
  assert.match(state.client, /提交成功/);
  assert.match(state.walfile, /0\/260/);
  assert.match(state.buffers, /Dirty/);
  assert.match(state.relation, /0\/200/);
});
