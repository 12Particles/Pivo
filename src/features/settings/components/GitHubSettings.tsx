import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, CheckCircle, KeyRound, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { GitHubAuthDialog } from '@/features/vcs/components/github/GitHubAuthDialog';
import { useGitHubAuth } from '@/hooks/domain/useVcs';

export function GitHubSettings() {
  const { t } = useTranslation();
  const { config: savedConfig, loading, update: updateConfig, refresh: refreshConfig } = useGitHubAuth();
  const [config, setConfig] = useState({
    username: '',
    defaultBranch: 'main',
    accessToken: undefined as string | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Update local state when saved config changes
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        username: (savedConfig as any)?.username || '',
        defaultBranch: (savedConfig as any)?.defaultBranch || 'main',
        accessToken: (savedConfig as any)?.accessToken,
      });
    }
  }, [savedConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateConfig(config!);
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
    refreshConfig();
  };

  const handleClearToken = async () => {
    if (!window.confirm('Are you sure you want to remove your GitHub access token?')) {
      return;
    }

    try {
      setSaving(true);
      setConfig(prev => ({ ...prev, accessToken: undefined }));
      await updateConfig(config!);
      setConfig(prev => ({ ...prev, accessToken: undefined }));
      refreshConfig();
      toast({
        title: t('toast.success'),
        description: 'GitHub access token removed successfully',
      });
    } catch (error) {
      console.error('Failed to clear GitHub token:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to remove GitHub access token',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.github.title')}</CardTitle>
          <CardDescription>
            {t('settings.github.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">
                  {t('settings.github.oauth')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.github.oauthDescription')}
                </p>
              </div>
              {config.accessToken ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('settings.github.authorized')}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearToken}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuthDialog(true)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {t('settings.github.authorize')}
                </Button>
              )}
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                {t('settings.github.username')}
              </Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                placeholder="octocat"
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.github.usernameHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultBranch">
                {t('settings.github.defaultBranch')}
              </Label>
              <Input
                id="defaultBranch"
                value={config.defaultBranch}
                onChange={(e) => setConfig(prev => ({ ...prev, defaultBranch: e.target.value }))}
                placeholder="main"
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.github.defaultBranchHelp')}
              </p>
            </div>
          </div>

          {/* Status Messages */}
          {!config.accessToken && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('settings.github.noTokenWarning')}
              </AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
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
    </div>
  );
}