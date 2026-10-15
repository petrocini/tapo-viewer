import assert from 'node:assert/strict';
import test from 'node:test';
import { bridgeEnvironment, parseCameraConfig } from '../src/config.js';

test('accepts a local camera address and keeps password spacing', () => {
  assert.deepEqual(parseCameraConfig({ ip: ' 192.168.1.42 ', username: 'camerauser', password: ' secret-pass ' }), {
    ip: '192.168.1.42', username: 'camerauser', password: ' secret-pass '
  });
});

test('rejects public, loopback and malformed addresses', () => {
  for (const ip of ['8.8.8.8', '127.0.0.1', '192.168.1.999', '192.168.1.1:554', 'bad-host']) {
    assert.throws(() => parseCameraConfig({ ip, username: 'camerauser', password: 'secret-pass' }), /IP.*rede local/);
  }
});

test('rejects missing credentials', () => {
  assert.throws(() => parseCameraConfig({ ip: '10.0.0.5', username: '', password: 'secret-pass' }), /usuário/i);
  assert.throws(() => parseCameraConfig({ ip: '10.0.0.5', username: 'camerauser', password: '' }), /senha/i);
});

test('encodes reserved credential characters for the RTSP source', () => {
  const env = bridgeEnvironment({ ip: '172.16.4.8', username: 'cam@user', password: 'p:a#ss' });
  assert.equal(env.CAMERA_IP, '172.16.4.8');
  assert.equal(env.CAMERA_USER, 'cam%40user');
  assert.equal(env.CAMERA_PASSWORD, 'p%3Aa%23ss');
});
