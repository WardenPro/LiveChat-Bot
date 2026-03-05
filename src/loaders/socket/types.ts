import type { Socket } from 'socket.io';
import type { OverlayPeerInfo, OverlaySessionMode } from '@livechat/overlay-protocol';

export type OverlaySocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface OverlaySocketClientRecord {
  id: string;
  guildId: string;
  label: string;
  sessionMode?: unknown;
  defaultAuthorName?: unknown;
  defaultAuthorImage?: unknown;
}

export interface OverlayPlaybackStateUpdate {
  guildId: string;
  jobId: string | null;
  state: 'playing' | 'paused' | 'ended';
  remainingMs: number | null;
}

export interface OverlayPlaybackStopUpdate {
  guildId: string;
  jobId: string;
}

export interface OverlayPlaybackPreemptionUpdate {
  guildId: string;
  preemptingJobId: string;
}

export interface OverlayPlaybackScheduler {
  onJobEnqueued(guildId: string): Promise<void>;
  onPlaybackState(payload: OverlayPlaybackStateUpdate): Promise<void>;
  onPlaybackStopped(payload: OverlayPlaybackStopUpdate): Promise<void>;
  preemptWithJob(payload: OverlayPlaybackPreemptionUpdate): Promise<void>;
}

export interface OverlayConnectionPeer extends OverlayPeerInfo {}

export interface OverlayConnectionState {
  onConnected(socket: OverlaySocket, guildId: string): void;
  onDisconnecting(socket: OverlaySocket, guildId: string): void;
  onDisconnected(socket: OverlaySocket, guildId: string, reason: string): Promise<void>;
  broadcastPeers(guildId: string): Promise<void>;
}

export interface OverlaySocketAuthContext {
  guildId: string;
  overlayClientId: string;
  overlayClientLabel: string;
  overlaySessionMode: OverlaySessionMode;
  overlayAuthorName?: string;
  overlayAuthorImage?: string;
}
