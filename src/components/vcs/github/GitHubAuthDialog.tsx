import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExternalLink, Copy, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { githubService } from '@/lib/services/githubService';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { open as openUrl } from '@tauri-apps/plugin-shell';

interface GitHubAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export function GitHubAuthDialog({ open, onOpenChange, onSuccess }: GitHubAuthDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'idle' | 'device-code' | 'polling' | 'success' | 'error'>('idle');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      // Create new abort controller for this session
      abortControllerRef.current = new AbortController();
      startDeviceFlow();
    } else {
      // Abort any ongoing operations when dialog closes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setStep('idle');
      setDeviceCode(null);
      setErrorMessage('');
      setCopied(false);
    }
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [open]);

  const startDeviceFlow = async () => {
    if (step !== 'idle') return; // Prevent multiple calls
    
    try {
      setStep('device-code');
      const response = await githubService.startDeviceFlow();
      setDeviceCode(response);
      
      // Start polling for authorization
      setTimeout(() => {
        setStep('polling');
        pollForAuthorization(response);
      }, 2000);
    } catch (error) {
      console.error('Failed to start device flow:', error);
      setErrorMessage(t('github.deviceFlowError'));
      setStep('error');
    }
  };

  const pollForAuthorization = async (codeResponse: DeviceCodeResponse) => {
    const startTime = Date.now();
    const expiresAt = startTime + (codeResponse.expires_in * 1000);
    
    const poll = async () => {
      // Check if aborted
      if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
        console.log('Polling aborted');
        return;
      }

      if (Date.now() > expiresAt) {
        setErrorMessage(t('github.authorizationExpired'));
        setStep('error');
        return;
      }

      try {
        console.log('Polling for authorization...');
        const result = await githubService.pollDeviceAuthorization(codeResponse.device_code);
        console.log('Poll result:', result);
        
        // Check again after async operation
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
          console.log('Polling aborted after request');
          return;
        }
        
        if (result.status === 'success') {
          console.log('Authorization successful!');
          setStep('success');
          setTimeout(() => {
            onSuccess();
            onOpenChange(false);
          }, 1500);
        } else if (result.status === 'pending') {
          // Check if we need to slow down
          const interval = result.slow_down ? codeResponse.interval * 2 : codeResponse.interval;
          
          // Schedule next poll
          const timeoutId = setTimeout(poll, interval * 1000);
          
          // Cancel timeout if aborted
          abortControllerRef.current.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          }, { once: true });
        } else {
          setErrorMessage(result.error || t('github.authorizationFailed'));
          setStep('error');
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error?.name === 'AbortError') {
          console.log('Polling aborted with error');
          return;
        }
        
        console.error('Polling error:', error);
        // Retry on network errors
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
          const timeoutId = setTimeout(poll, codeResponse.interval * 1000);
          abortControllerRef.current.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          }, { once: true });
        }
      }
    };

    poll();
  };

  const copyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      toast({
        title: t('common.copied'),
        description: t('github.codeCopied'),
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openGitHub = async () => {
    if (deviceCode) {
      try {
        await openUrl(deviceCode.verification_uri);
      } catch (error) {
        console.error('Failed to open browser:', error);
        toast({
          title: t('common.error'),
          description: 'Failed to open browser',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('github.authorizeTitle')}</DialogTitle>
          <DialogDescription>
            {t('github.authorizeDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(step === 'device-code' || step === 'polling') && deviceCode && (
            <>
              <Card className="p-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    {t('github.enterCode')}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-2xl font-mono font-bold tracking-wider">
                      {deviceCode.user_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyCode}
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-center">
                  <Button onClick={openGitHub} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t('github.openGitHub')}
                  </Button>
                </div>
              </Card>

              <div className="text-center">
                {step === 'polling' ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {t('github.waitingForAuthorization')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('github.waitingForAuthorization')}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">
                {t('github.authorizationSuccess')}
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-sm text-red-500">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={startDeviceFlow}
              >
                {t('common.retry')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}