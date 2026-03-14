/** Directional variant for a socket anchor */
export type SocketDirection = 'none' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Role/purpose of a socket anchor */
export type SocketRole = 'hand' | 'foot' | 'root' | 'weapon' | 'back' | 'custom';

/** An attachment point on a layer */
export interface SocketAnchor {
  id: string;
  layerId: string;
  name: string;
  x: number;
  y: number;
  direction: SocketDirection;
  role: SocketRole;
}
