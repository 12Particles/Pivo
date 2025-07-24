import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useGitLabAuth } from '@/hooks/domain/useVcs';

export function GitLabSettings() {
  const { t } = useTranslation();
  const { config: savedConfig, loading, update: updateConfig } = useGitLabAuth();
  const [config, setConfig] = useState({
    pat: '',
    gitlabUrl: 'https://gitlab.com',
    defaultBranch: 'main',
  });
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Update local state when saved config changes
  useEffect(() => {
    if (savedConfig) {
      setConfig({
        pat: (savedConfig as any)?.pat || '',
        gitlabUrl: (savedConfig as any)?.gitlabUrl || 'https://gitlab.com',
        defaultBranch: (savedConfig as any)?.defaultBranch || 'main',
      });
    }
  }, [savedConfig]);

  const handleSave = async () => {
    if (!config.pat) {
      toast({
        title: t('toast.warning'),
        description: 'Personal Access Token is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await updateConfig();
      toast({
        title: t('toast.success'),
        description: 'GitLab configuration saved successfully',
      });
    } catch (error) {
      console.error('Failed to save GitLab config:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to save GitLab configuration',
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
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.gitlab.title')}</CardTitle>
        <CardDescription>
          {t('settings.gitlab.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pat">
            {t('settings.gitlab.pat')}
          </Label>
          <div className="flex space-x-2">
            <Input
              id="pat"
              type={showToken ? 'text' : 'password'}
              value={config.pat}
              onChange={(e) => setConfig(prev => ({ ...prev, pat: e.target.value }))}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? t('common.hide') : t('common.show')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.gitlab.patHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlabUrl">
            {t('settings.gitlab.url')}
          </Label>
          <Input
            id="gitlabUrl"
            value={config.gitlabUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, gitlabUrl: e.target.value }))}
            placeholder="https://gitlab.com"
          />
          <p className="text-sm text-muted-foreground">
            {t('settings.gitlab.urlHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultBranch">
            {t('settings.gitlab.defaultBranch')}
          </Label>
          <Input
            id="defaultBranch"
            value={config.defaultBranch}
            onChange={(e) => setConfig(prev => ({ ...prev, defaultBranch: e.target.value }))}
            placeholder="main"
          />
          <p className="text-sm text-muted-foreground">
            {t('settings.gitlab.defaultBranchHelp')}
          </p>
        </div>

        {config.pat && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              {t('settings.gitlab.tokenConfigured')}
            </AlertDescription>
          </Alert>
        )}

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
  );
}