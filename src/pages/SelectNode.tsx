import { useEffect, useState } from "react";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import NodeCard from "../components/NodeCard";
import axios from "axios";
import { defaultNodeList, defaultNodeNameList } from "../config/nodes";

interface NodeType {
  id: number;
  name: string;
  address: string;
  status: string;
  latency: number;
}

function SelectNode() {
  const {
    wallet,
    nodeList,
    nodeNameList,
    selectedNodeIndex,
    setSelectedNodeIndex,
    setNodeList,
    setNodeNameList,
  } = useWallet();

  const [nodes, setNodes] = useState<NodeType[]>([] as NodeType[]);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State for dialog visibility
  const [newNodeAddress, setNewNodeAddress] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [warning, setWarning] = useState(false);

  const setPrimaryNode = (id: number) => {
    console.log("Primary Node Set");
    setSelectedNodeIndex(id);
  };

  const removeNode = (id: number) => {
    const newNodeList = nodeList.filter((_, index) => index !== id);
    setNodeList(newNodeList);
    setNodeNameList(nodeNameList.filter((_, index) => index !== id));

    if (newNodeList.length === 0) {
      setSelectedNodeIndex(0);
    } else if (id === selectedNodeIndex) {
      setSelectedNodeIndex(Math.min(id, newNodeList.length - 1));
    } else if (selectedNodeIndex >= id) {
      setSelectedNodeIndex(Math.max(0, selectedNodeIndex - 1));
    }
  };

  const resetToFactorySettings = () => {
    setNodeList(defaultNodeList);
    setNodeNameList(defaultNodeNameList);
    setSelectedNodeIndex(0);
  };

  const handleAddNode = () => {
    // Logic to add the new node
    console.log("Adding node:", newNodeAddress);
    // Regular expression to validate URL format
    const urlPattern =
      /^(https?:\/\/)(([a-z0-9-]+\.)+[a-z]{2,}|(\d{1,3}\.){3}\d{1,3})(:\d{1,5})?(\/.*)?$/i;

    if (newNodeAddress.length === 0) {
      setWarning(true);
      return;
    }

    if (!urlPattern.test(newNodeAddress)) {
      setWarning(true); // Set warning if the address is invalid
      return;
    }

    const len = nodeList.length;
    setNodeList([...nodeList, newNodeAddress]);
    setNodeNameList([...nodeNameList, newNodeName]);
    setSelectedNodeIndex(len);

    // Reset the input and close the dialog
    setNewNodeName("");
    setNewNodeAddress("");
    setIsDialogOpen(false);
  };

  const handleCancel = () => {
    setNewNodeAddress("");
    setIsDialogOpen(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const measureLatency = async (address: string, index: number) => {
    const start = performance.now(); // Start time
    try {
      await axios.get(`${address}/account/${wallet}/balance`, {
        timeout: 5000,
      }); // Replace with the appropriate endpoint
      const end = performance.now(); // End time
      const latency = end - start; // Calculate latency
      setNodes((prev) => {
        const newNodes = [...prev];
        newNodes[index].latency = latency;
        newNodes[index].status = "online";
        return newNodes;
      });
    } catch (error) {
      console.log(error);
      setNodes((prev) => {
        const newNodes = [...prev];
        newNodes[index].status = "offline";
        return newNodes;
      });
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (nodeList.length == 0) {
      console.log(`**** no supported nodes:`, nodeList.length);
    } else {
      // Initialize node statuses to "Checking"
      setNodes(
        nodeList.map((node, index) => ({
          id: index,
          name: nodeNameList[index], // Assign a name based on the index
          address: node, // Use the address from nodeList
          status: "Checking", // Initialize status as "Checking"
          latency: 0, // Initialize latency as 0
        })),
      );
      if (isDialogOpen) {
        nodeList.forEach((node, index) => {
          measureLatency(node, index); // Measure latency for each node
        });
        // Set up an interval to measure latency every 5 seconds (5000 ms)
        interval = setInterval(() => {
          nodeList.forEach((node, index) => {
            measureLatency(node, index); // Measure latency for each node
          });
        }, 5000); // Adjust the interval as needed
      }
    }
    console.log("**** ", nodeList);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isDialogOpen, measureLatency, nodeList, nodeNameList, wallet]);

  return (
    <div className="min-h-screen container relative px-4">
      <Header title="Select A Node" />
      <div className="h-[63vh] overflow-y-scroll mt-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {nodes.length > 0 ? (
          nodes.map((node, index) => (
            <NodeCard
              key={index}
              {...node}
              setPrimaryNode={setPrimaryNode}
              removeNode={removeNode}
            />
          ))
        ) : (
          <div className="text-center text-white/50 mt-12">No nodes found</div>
        )}
      </div>
      <div className="absolute bottom-6 w-full left-0 px-4 flex gap-3">
        <Button
          variant="primary"
          ariaLabel="Add Node"
          onClick={() => setIsDialogOpen(true)}
          className="flex-1"
        >
          + Add
        </Button>
        <button
          onClick={resetToFactorySettings}
          className="flex-1 py-3 text-sm text-white/40 hover:text-red-400 transition-colors border border-white/10 hover:border-red-400/50 rounded-xl"
        >
          Reset
        </button>
      </div>
      {/* Popup Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-white/10 shadow-2xl w-[340px]">
            <h3 className="text-white text-xl font-semibold mb-6">
              Add new Node
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Node Name"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                placeholder="Node Address (https://...)"
                value={newNodeAddress}
                onChange={(e) => setNewNodeAddress(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            {warning && (
              <p className="text-red-400 text-sm mt-3">
                Please enter a valid URL (https://...)
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddNode}
                className="flex-1"
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
