import { useEffect, useState, useCallback } from "react";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import NodeCard from "../components/NodeCard";
import { PRESET_NODES, type NodeNetwork, type WalletNode } from "../config/network";
import {
  familyLabel,
  labelForNodeUrl,
  nodeForFamily,
  normalizeNodeUrl,
} from "../utils/nodes";
import { probeNode } from "../utils/warthogNode";
import { ensureHostPermission } from "../utils/hostAccess";

interface NodeType {
  id: number;
  name: string;
  address: string;
  status: string;
  latency: number;
  network: NodeNetwork;
}

/**
 * The node list.
 *
 * With a family, the page is pinned to it: no tabs, and only that family's
 * nodes. It edits the same list and the same selection as the unpinned
 * page, so the two cannot drift apart.
 */
function SelectNode({ family }: { family?: NodeNetwork } = {}) {
  const {
    wallet,
    nodeList,
    setSelectedNodeUrl,
    setNodeList,
    activeNetwork,
    setActiveNetwork,
    selectedNodeUrls,
  } = useWallet();

  const [nodes, setNodes] = useState<NodeType[]>([] as NodeType[]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newNodeAddress, setNewNodeAddress] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [warning, setWarning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Which family the node being added belongs to. The user says, not the URL.
  const [newNodeNetwork, setNewNodeNetwork] =
    useState<NodeNetwork>("mainnet");

  // The tab is which family the list shows. The page opens on the family
  // the wallet is on, so the picker reflects where the wallet actually is.
  // The tab is its own state, so a family with no node can still be opened
  // and a node added to it, without switching the wallet.
  const [tab, setTab] = useState<NodeNetwork>(family ?? activeNetwork);

  useEffect(() => {
    setTab(family ?? activeNetwork);
  }, [family, activeNetwork]);

  // Whether the open tab has any node, and whether one of them is the
  // selected one. A tab can have nodes and none selected, which is the
  // state the warning is for.
  const tabHasNodes = nodes.some((node) => node.network === tab);
  const tabHasSelection = Boolean(
    nodeForFamily(nodeList, tab, selectedNodeUrls),
  );

  const visibleNodes = nodes.filter((node) => {
    if (node.network !== tab) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      node.name.toLowerCase().includes(q) ||
      node.address.toLowerCase().includes(q)
    );
  });

  const setPrimaryNode = async (id: number) => {
    const node = nodeList[id];
    if (node && !(await ensureHostPermission(node.url))) {
      setWarning(true);
      return;
    }
    if (node) setSelectedNodeUrl(node.url);
  };

  const removeNode = (id: number) => {
    // Keep at least one node
    if (nodeList.length <= 1) return;
    setNodeList(nodeList.filter((_, index) => index !== id));
  };

  // The dialog asks which family the node belongs to. It starts on the tab
  // the wallet is on, which is where a new node is most likely wanted. A
  // pinned page has one family, so the question is not asked.
  useEffect(() => {
    setNewNodeNetwork(family ?? tab);
  }, [family, tab]);

  const handleAddNode = async () => {
    const urlPattern =
      /^(https?:\/\/)(([a-z0-9-]+\.)+[a-z]{2,}|(\d{1,3}\.){3}\d{1,3})(:\d{1,5})?(\/.*)?$/i;

    const normalized = normalizeNodeUrl(newNodeAddress);
    if (!normalized || !urlPattern.test(normalized)) {
      setWarning(true);
      return;
    }

    if (nodeList.some((n) => normalizeNodeUrl(n.url) === normalized)) {
      setWarning(true);
      return;
    }

    if (!(await ensureHostPermission(normalized))) {
      setWarning(true);
      return;
    }

    const name = newNodeName.trim() || labelForNodeUrl(normalized);
    const node: WalletNode = { url: normalized, name, network: newNodeNetwork };
    setNodeList([...nodeList, node]);
    setSelectedNodeUrl(node.url);
    setNewNodeName("");
    setNewNodeAddress("");
    setIsDialogOpen(false);
    setWarning(false);
  };

  const handleAddPresets = (network: NodeNetwork) => {
    const toAdd = PRESET_NODES.filter((p) => p.network === network);
    const next = [...nodeList];
    for (const p of toAdd) {
      const n = normalizeNodeUrl(p.url);
      if (!next.some((node) => normalizeNodeUrl(node.url) === n)) {
        next.push({ url: n, name: p.name, network: p.network });
      }
    }
    setNodeList(next);
  };

  const handleCancel = () => {
    setNewNodeAddress("");
    setNewNodeName("");
    setIsDialogOpen(false);
    setWarning(false);
  };

  const measureLatency = useCallback(
    async (node: WalletNode, index: number) => {
      const result = await probeNode(node, wallet);
      setNodes((prev) => {
        const newNodes = [...prev];
        if (!newNodes[index]) return prev;
        newNodes[index] = {
          ...newNodes[index],
          latency: result.latencyMs,
          status: result.online ? "online" : "offline",
        };
        return newNodes;
      });
    },
    [wallet],
  );

  useEffect(() => {
    if (nodeList.length === 0) {
      setNodes([]);
      return;
    }

    setNodes(
      nodeList.map((node, index) => ({
        id: index,
        name: node.name || labelForNodeUrl(node.url),
        address: node.url,
        status: "Checking",
        latency: 0,
        network: node.network,
      })),
    );

    nodeList.forEach((node, index) => {
      measureLatency(node, index);
    });

    const interval = setInterval(() => {
      nodeList.forEach((node, index) => {
        measureLatency(node, index);
      });
    }, 10_000);

    return () => clearInterval(interval);
  }, [measureLatency, nodeList]);

  return (
    <div className="min-h-screen container relative px-4">
      <Header title={family ? `${familyLabel(family)} Nodes` : "Select A Node"} />

      {family ? (
        <p className="text-white/45 text-xs mb-3 leading-relaxed">
          SafeTrade buys on the Warthog mainnet, and there is no Warthog
          testnet for it, so it needs a mainnet node.
        </p>
      ) : null}

      {family ? null : (
      <div className="flex gap-2 mb-3 flex-wrap">
        {(
          [
            ["mainnet", "Mainnet"],
            ["defi-testnet", "DeFi Testnet"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              // The family changes either way, like the badge does. The
              // card says which family is missing a node, and the tab
              // still lists it so a node can be added.
              setActiveNetwork(id);
            }}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              tab === id
                ? "bg-primary/20 border-primary text-primary"
                : "border-white/20 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      )}

      <div className="relative w-full mb-2">
        <input
          className="h-14 w-full pl-12 pr-4 py-2 bg-primary/10 rounded-full border border-primary focus:outline-hidden focus:ring-2 focus:ring-primary"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <img
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6"
          src="icons/search-icon.svg"
          alt="Search Icon"
        />
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className={`text-xs underline ${
            tab === "mainnet" ? "text-primary" : "text-amber-300"
          }`}
          onClick={() => handleAddPresets(tab)}
        >
          + {familyLabel(tab)} presets
        </button>
      </div>

      {tabHasNodes && !tabHasSelection ? (
        <p className="text-xs text-amber-300 mb-2">
          No {familyLabel(tab)} node selected. Pick one to use the{" "}
          {tab === "mainnet" ? "mainnet" : "testnet"}.
        </p>
      ) : null}

      <div className="h-[55vh] overflow-y-scroll">
        {visibleNodes.length > 0 ? (
          visibleNodes.map((node) => (
            <NodeCard
              key={node.id}
              {...node}
              setPrimaryNode={setPrimaryNode}
              removeNode={removeNode}
            />
          ))
        ) : (
          <div className="text-center text-white/50 mt-6">
            {tabHasNodes ? "No nodes found" : `No ${familyLabel(tab)} node configured`}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 w-full left-0 px-4">
        <Button
          variant="primary"
          ariaLabel="Add Node"
          onClick={() => setIsDialogOpen(true)}
          className="w-full"
        >
          + Add more nodes
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-[#1A1A1A] p-4 rounded-sm shadow-lg w-[300px]">
            <h3 className="text-white text-xl font-semibold mb-4">
              Add new Node
            </h3>
            <p className="text-white/50 text-xs mb-2">
              {family === "mainnet" ? (
                "Mainnet example: https://warthognode.duckdns.org"
              ) : family === "defi-testnet" ? (
                "DeFi testnet: https://warthog-defitestnet.duckdns.org"
              ) : (
                <>
                  Mainnet example: https://warthognode.duckdns.org
                  <br />
                  DeFi testnet: https://warthog-defitestnet.duckdns.org
                </>
              )}
            </p>
            {family ? null : (
              <>
                <p className="text-white/50 text-xs mb-1">
                  Which network is this node on?
                </p>
                <div className="flex gap-2 mb-2">
                  {(
                    [
                      ["mainnet", "Mainnet"],
                      ["defi-testnet", "DeFi Testnet"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setNewNodeNetwork(id)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-lg border ${
                        newNodeNetwork === id
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-white/20 text-white/60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <input
              type="text"
              placeholder="Node Name"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              className="w-full min-w-[150px] bg-[#2A2A2A] border border-primary/25 rounded-lg p-3 text-white focus:outline-hidden focus:border-primary mb-1"
            />
            <input
              type="text"
              placeholder="Node Address"
              value={newNodeAddress}
              onChange={(e) => {
                setNewNodeAddress(e.target.value);
                setWarning(false);
              }}
              className="w-full min-w-[150px] bg-[#2A2A2A] border border-primary/25 rounded-lg p-3 text-white focus:outline-hidden focus:border-primary"
            />
            {warning && (
              <p className="text-red-500 text-xs mt-1">
                Please enter a valid, unique node URL
              </p>
            )}
            <div className="flex justify-end mt-4">
              <Button
                variant="secondary"
                onClick={handleCancel}
                className="mr-2 w-full"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddNode}
                className="w-full"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectNode;
