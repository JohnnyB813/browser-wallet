import nodes from '../../config/nodes.json';
import type { NodeNetwork, WalletNode } from './network';

/** The development node list, as records. */
export const defaultNodes: WalletNode[] = nodes.nodes.map((node) => ({
  url: node.url,
  name: node.label,
  network: node.network as NodeNetwork,
}));

export const explorerBaseUrl: string = nodes.explorerBaseUrl || 'https://explorer.warthog.network';
