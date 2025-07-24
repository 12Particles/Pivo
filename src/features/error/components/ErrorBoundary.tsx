/**
 * Global error boundary component
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/events/EventBus';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Error Boundary caught error', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
    });
    
    // Emit error event
    eventBus.emit('error-occurred', {
      error,
      context: 'React Error Boundary',
      retryable: true,
    }).catch(console.error);
    
    this.setState({ errorInfo });
  }
  
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };
  
  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      
      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred. The error has been logged and our team will investigate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-mono text-muted-foreground">
                  {this.state.error.message}
                </p>
              </div>
              
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="cursor-pointer">
                  <summary className="text-sm text-muted-foreground hover:text-foreground">
                    Show technical details
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                    {this.state.error.stack}
                    {'\n\n'}
                    Component Stack:
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return this.props.children;
  }
}