import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useEthereum } from "@/hooks/use-ethereum";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function ConnectWallet() {
  const { address, connect, disconnect, isConnected, isBaseNetwork, switchToBase } = useEthereum();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      await connect();
      toast({
        title: "Wallet Connected",
        description: "Successfully connected to MetaMask"
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error?.message || "Could not connect to MetaMask",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchToBase = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      await switchToBase();
      toast({
        title: "Network Switched",
        description: "Successfully switched to Base network"
      });
    } catch (error: any) {
      console.error('Network switch error:', error);
      toast({
        title: "Network Switch Failed",
        description: error?.message || "Could not switch to Base network",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Successfully disconnected wallet"
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  if (!window.ethereum) {
    return (
      <Button 
        variant="destructive"
        onClick={() => window.open('https://metamask.io/download/', '_blank')}
      >
        <Wallet className="mr-2 h-4 w-4" />
        Install MetaMask
      </Button>
    );
  }

  if (isConnected && !isBaseNetwork) {
    return (
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={handleDisconnect}
          disabled={isConnecting}
        >
          <Wallet className="mr-2 h-4 w-4" />
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </Button>
        <Button 
          onClick={handleSwitchToBase} 
          variant="secondary"
          disabled={isConnecting}
        >
          {isConnecting ? 'Switching...' : 'Switch to Base'}
        </Button>
      </div>
    );
  }

  if (isConnected) {
    return (
      <Button 
        variant="outline" 
        onClick={handleDisconnect}
        disabled={isConnecting}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleConnect}
      disabled={isConnecting}
    >
      <Wallet className="mr-2 h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}