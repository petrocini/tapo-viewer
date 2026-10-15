import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { bridgeEnvironment, type CameraConfig } from './config.js';

export interface BridgeStatus {
  state: 'disconnected' | 'connecting' | 'live' | 'error';
  message?: string;
}

export interface CameraBridge {
  connect(config: CameraConfig): Promise<void>;
  disconnect(): Promise<void>;
  status(): BridgeStatus;
  refreshStatus(): Promise<BridgeStatus>;
}

interface BridgeOptions {
  binaryPath: string;
  configPath: string;
  spawnProcess?: (binary: string, args: string[], options: SpawnOptions) => ChildProcess;
  probe?: () => Promise<boolean>;
  ready?: () => Promise<boolean>;
}

export class BridgeManager implements CameraBridge {
  private child: ChildProcess | null = null;
  private currentStatus: BridgeStatus = { state: 'disconnected' };
  private queue: Promise<void> = Promise.resolve();
  private startedAt = 0;
  private readonly spawnProcess: NonNullable<BridgeOptions['spawnProcess']>;
  private readonly probe: NonNullable<BridgeOptions['probe']>;
  private readonly ready: NonNullable<BridgeOptions['ready']>;

  constructor(private readonly options: BridgeOptions) {
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.probe = options.probe ?? probeStream;
    this.ready = options.ready ?? probeBridgeApi;
  }

  status(): BridgeStatus {
    return { ...this.currentStatus };
  }

  connect(config: CameraConfig): Promise<void> {
    const operation = this.queue.then(async () => {
      await this.stopChild();
      this.currentStatus = { state: 'connecting', message: 'Conectando à câmera…' };
      this.startedAt = Date.now();
      try {
        const child = this.spawnProcess(
          this.options.binaryPath,
          ['-config', this.options.configPath],
          { env: { ...process.env, ...bridgeEnvironment(config) }, stdio: 'ignore', windowsHide: true }
        );
        this.child = child;
        child.on('error', () => {
          if (this.child === child) {
            this.child = null;
            this.currentStatus = { state: 'error', message: 'Não foi possível iniciar o serviço de vídeo.' };
          }
        });
        child.on('exit', () => {
          if (this.child === child) {
            this.child = null;
            this.currentStatus = { state: 'error', message: 'O serviço de vídeo foi encerrado. Tente reconectar.' };
          }
        });
        let endpointReady = false;
        for (let attempt = 0; attempt < 50 && this.child === child; attempt++) {
          try {
            endpointReady = await this.ready();
          } catch {
            endpointReady = false;
          }
          if (endpointReady) break;
          await delay(100);
        }
        if (!endpointReady && this.child === child) {
          await this.stopChild();
          this.currentStatus = { state: 'error', message: 'O serviço de vídeo não ficou disponível. Tente novamente.' };
        }
      } catch {
        this.currentStatus = { state: 'error', message: 'Não foi possível iniciar o serviço de vídeo.' };
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  disconnect(): Promise<void> {
    const operation = this.queue.then(async () => {
      await this.stopChild();
      this.currentStatus = { state: 'disconnected' };
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async refreshStatus(): Promise<BridgeStatus> {
    await this.queue;
    if (!this.child || !['connecting', 'live'].includes(this.currentStatus.state)) {
      return this.status();
    }
    const child = this.child;
    const startedAt = this.startedAt;

    let connected = false;
    try {
      connected = await this.probe();
    } catch {
      connected = false;
    }
    if (this.child !== child || this.startedAt !== startedAt || !['connecting', 'live'].includes(this.currentStatus.state)) {
      return this.status();
    }

    if (connected) {
      this.currentStatus = { state: 'live', message: 'Transmissão ao vivo' };
    } else if (Date.now() - this.startedAt > 15_000) {
      this.currentStatus = { state: 'error', message: 'Não foi possível receber o vídeo. Confira o IP e a Conta da Câmera.' };
    } else {
      this.currentStatus = { state: 'connecting', message: 'Aguardando vídeo da câmera…' };
    }
    return this.status();
  }

  private async stopChild(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = null;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 3_000);
      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      if (!child.kill()) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}

async function probeBridgeApi(): Promise<boolean> {
  const response = await fetch('http://127.0.0.1:1984/api/streams?src=tapo-c500', {
    signal: AbortSignal.timeout(700)
  });
  return response.ok;
}

async function probeStream(): Promise<boolean> {
  const response = await fetch('http://127.0.0.1:1984/api/streams?src=tapo-c500', {
    signal: AbortSignal.timeout(1_500)
  });
  if (!response.ok) return false;
  const info = await response.json() as { producers?: Array<{ receivers?: unknown[]; bytes_recv?: number }> };
  return Array.isArray(info.producers) && info.producers.some(
    (producer) => (producer.receivers?.length ?? 0) > 0 || (producer.bytes_recv ?? 0) > 0
  );
}
