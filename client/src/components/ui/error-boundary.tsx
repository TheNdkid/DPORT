import React from 'react';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isOffline: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isOffline: !navigator.onLine
    };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleNetworkChange);
    window.removeEventListener('offline', this.handleNetworkChange);
  }

  handleNetworkChange = () => {
    this.setState({ isOffline: !navigator.onLine });
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isOffline: !navigator.onLine };
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error, isOffline } = this.state;
    const { children, fallback } = this.props;

    if (isOffline) {
      return (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Network Error</AlertTitle>
          <AlertDescription>
            You appear to be offline. Please check your internet connection and try again.
          </AlertDescription>
        </Alert>
      );
    }

    if (hasError) {
      const errorMessage = this.getUserFriendlyError(error);
      
      if (fallback) {
        return fallback;
      }

      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.reset}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return children;
  }

  private getUserFriendlyError(error: Error | null): string {
    if (!error) return 'An unknown error occurred';

    // RPC-specific errors
    if (error.message.includes('eth_')) {
      return 'Unable to connect to the blockchain network. Please check your wallet connection and try again.';
    }

    // Network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }

    // Wallet errors
    if (error.message.includes('wallet_')) {
      return 'There was an issue with your wallet connection. Please ensure your wallet is unlocked and connected to the correct network.';
    }

    // Contract errors
    if (error.message.includes('execution reverted')) {
      return 'The transaction was rejected by the network. This might be due to insufficient funds or contract restrictions.';
    }

    // Chain ID errors
    if (error.message.includes('chain ID') || error.message.includes('network')) {
      return 'Please switch to the Base network to use this application.';
    }

    return error.message;
  }
}
