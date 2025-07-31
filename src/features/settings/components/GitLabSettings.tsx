import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';
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
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleAutoSave = async (newConfig: typeof config) => {
    try {
      setSaving(true);
      await updateConfig(newConfig!);
      setHasChanges(false);
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

  const handleFieldChange = (field: keyof typeof config, value: string) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleFieldBlur = () => {
    if (hasChanges && config.pat) {
      handleAutoSave(config);
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
              onChange={(e) => handleFieldChange('pat', e.target.value)}
              onBlur={handleFieldBlur}
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
            onChange={(e) => handleFieldChange('gitlabUrl', e.target.value)}
            onBlur={handleFieldBlur}
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
            onChange={(e) => handleFieldChange('defaultBranch', e.target.value)}
            onBlur={handleFieldBlur}
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

        {/* Auto-save indicator */}
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('common.saving')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}