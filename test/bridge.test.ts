import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { BridgeManager } from '../src/bridge.js';

class FakeProcess extends EventEmitter {
  killed = false;
  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit('exit', 0));
    return true;
  }
}

function managerFixture(probe = async () => false, ready = async () => true) {
  const children: FakeProcess[] = [];
  const environments: NodeJS.ProcessEnv[] = [];
  const manager = new BridgeManager({
    binaryPath: 'fake-go2rtc.exe',
    configPath: 'fake-go2rtc.yaml',
    spawnProcess: (_bin: string, _args: string[], options: SpawnOptions) => {
      const child = new FakeProcess();
      children.push(child);
      environments.push(options.env ?? {});
      return child as ChildProcess;
    },
    probe,
    ready
  });
  return { manager, children, environments };
}

const config = { ip: '192.168.1.42', username: 'camerauser', password: 'private#password' };

test('starts the bridge with encoded credentials and reports video readiness', async () => {
  const fixture = managerFixture(async () => true);
  await fixture.manager.connect(config);
  assert.equal(fixture.manager.status().state, 'connecting');
  assert.equal(fixture.environments[0].CAMERA_PASSWORD, 'private%23password');
  assert.equal((await fixture.manager.refreshStatus()).state, 'live');
  assert.doesNotMatch(JSON.stringify(fixture.manager.status()), /private/);
  await fixture.manager.disconnect();
});

test('waits for the player endpoint before completing the connection request', async () => {
  let checks = 0;
  const fixture = managerFixture(async () => false, async () => ++checks >= 2);
  await fixture.manager.connect(config);
  assert.equal(checks, 2);
  assert.equal(fixture.manager.status().state, 'connecting');
  await fixture.manager.disconnect();
});

test('two rapid connections keep only the newest bridge', async () => {
  const fixture = managerFixture();
  await Promise.all([
    fixture.manager.connect(config),
    fixture.manager.connect({ ...config, ip: '192.168.1.43' })
  ]);
  assert.equal(fixture.children.length, 2);
  assert.equal(fixture.children[0].killed, true);
  assert.equal(fixture.children[1].killed, false);
  assert.equal(fixture.environments[1].CAMERA_IP, '192.168.1.43');
  await fixture.manager.disconnect();
});

test('unexpected process exit becomes a safe error and permits reconnection', async () => {
  const fixture = managerFixture();
  await fixture.manager.connect(config);
  fixture.children[0].emit('exit', 1);
  assert.equal(fixture.manager.status().state, 'error');
  assert.doesNotMatch(JSON.stringify(fixture.manager.status()), /private/);
  await fixture.manager.connect(config);
  assert.equal(fixture.manager.status().state, 'connecting');
  await fixture.manager.disconnect();
});

test('disconnect stops the process and clears the public state', async () => {
  const fixture = managerFixture();
  await fixture.manager.connect(config);
  await fixture.manager.disconnect();
  assert.equal(fixture.children[0].killed, true);
  assert.equal(fixture.manager.status().state, 'disconnected');
});

test('an old stream probe cannot restore live state after disconnect', async () => {
  let startProbe!: () => void;
  let finishProbe!: (connected: boolean) => void;
  const probeStarted = new Promise<void>((resolve) => { startProbe = resolve; });
  const pendingProbe = new Promise<boolean>((resolve) => { finishProbe = resolve; });
  const fixture = managerFixture(() => { startProbe(); return pendingProbe; });
  await fixture.manager.connect(config);
  const refresh = fixture.manager.refreshStatus();
  await probeStarted;
  await fixture.manager.disconnect();
  finishProbe(true);
  await refresh;
  assert.equal(fixture.manager.status().state, 'disconnected');
});
