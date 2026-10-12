import nodes from '../../config/nodes.json';

export const defaultNodeList: string[] = nodes.nodes.map(node => node.url);
export const defaultNodeNameList: string[] = nodes.nodes.map(node => node.label);
export const explorerBaseUrl: string = nodes.explorerBaseUrl || 'https://explorer.warthog.network';