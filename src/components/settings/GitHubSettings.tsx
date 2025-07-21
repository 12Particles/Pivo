import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, CheckCircle, KeyRound, Trash2 } from 'lucide-react';
import { githubService, type GitHubConfig } from '@/lib/services/githubService';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { GitHubAuthDialog } from '@/components/github/GitHubAuthDialog';

export function GitHubSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<GitHubConfig>({
    username: '',
    defaultBranch: 'main',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const savedConfig = await githubService.getConfig();
      if (savedConfig) {
        setConfig({
          username: savedConfig.username || '',
          defaultBranch: savedConfig.defaultBranch || 'main',
          accessToken: savedConfig.accessToken,
        });
      }
    } catch (error) {
      console.error('Failed to load GitHub config:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to load GitHub configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await githubService.updateConfig(config);
      toast({
        title: t('toast.success'),
        description: 'GitHub configuration saved successfully',
      });
    } catch (error) {
      console.error('Failed to save GitHub config:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to save GitHub configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAuthSuccess = () => {
    // Refresh config after successful authorization
    loadConfig();
    setShowAuthDialog(false);
  };

  const handleDisconnect = async () => {
    try {
      setSaving(true);
      const updatedConfig = { ...config, accessToken: undefined };
      await githubService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      toast({
        title: t('toast.success'),
        description: 'GitHub authorization removed successfully',
      });
    } catch (error) {
      console.error('Failed to remove GitHub authorization:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to remove GitHub authorization',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('github.config')}</CardTitle>
          <CardDescription>
            Configure GitHub integration for pull requests using OAuth Device Flow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authorization Status */}
          <div className="space-y-4">
            <Label>Authorization Status</Label>
            {config.accessToken ? (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="flex items-center justify-between">
                  <span>GitHub integration is authorized and ready to use.</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>GitHub is not authorized. Click to authorize with your GitHub account.</span>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowAuthDialog(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Authorize GitHub
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="github-username">{t('github.username')}</Label>
            <Input
              id="github-username"
              type="text"
              value={config.username || ''}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="your-github-username"
            />
            <p className="text-sm text-muted-foreground">
              Your GitHub username (optional)
            </p>
          </div>

          {/* Default Branch */}
          <div className="space-y-2">
            <Label htmlFor="github-branch">{t('github.defaultBranch')}</Label>
            <Input
              id="github-branch"
              type="text"
              value={config.defaultBranch || ''}
              onChange={(e) => setConfig({ ...config, defaultBranch: e.target.value })}
              placeholder="main"
            />
            <p className="text-sm text-muted-foreground">
              Default target branch for pull requests
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={loadConfig}
              disabled={loading || saving}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('common.save')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Auth Dialog */}
      <GitHubAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}