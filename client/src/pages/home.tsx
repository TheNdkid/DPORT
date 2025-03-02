import { ConnectWallet } from "@/components/connect-wallet";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-4 text-4xl font-bold">DeFi Portfolio Tracker</h1>
      <p className="mb-4 text-xl text-muted-foreground">
        Track, manage, and optimize your DeFi portfolio across multiple protocols
      </p>
      <div className="max-w-2xl text-muted-foreground">
        <p>
          Get real-time analytics, yield optimization suggestions, and risk metrics
          for your DeFi investments. Use the sidebar to connect your wallet and
          access the dashboard.
        </p>
      </div>
    </div>
  );
}