import { isIP } from 'node:net';

export interface CameraConfig {
  ip: string;
  username: string;
  password: string;
}

export function parseCameraConfig(input: unknown): CameraConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Informe o IP, o usuário e a senha da câmera.');
  }

  const fields = input as Record<string, unknown>;
  const ip = typeof fields.ip === 'string' ? fields.ip.trim() : '';
  const username = typeof fields.username === 'string' ? fields.username.trim() : '';
  const password = typeof fields.password === 'string' ? fields.password : '';

  if (isIP(ip) !== 4 || !isPrivateIpv4(ip)) {
    throw new Error('Informe um IP válido da rede local.');
  }
  if (!username) {
    throw new Error('Informe o usuário da Conta da Câmera.');
  }
  if (!password) {
    throw new Error('Informe a senha da Conta da Câmera.');
  }

  return { ip, username, password };
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export function bridgeEnvironment(config: CameraConfig): Record<string, string> {
  return {
    CAMERA_IP: config.ip,
    CAMERA_USER: encodeURIComponent(config.username),
    CAMERA_PASSWORD: encodeURIComponent(config.password)
  };
}
