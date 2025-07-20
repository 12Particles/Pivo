import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { gitlabService, type GitLabConfig } from '@/lib/services/gitlabService';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

export function GitLabSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<GitLabConfig>({
    pat: '',
    gitlabUrl: 'https://gitlab.com',
    defaultBranch: 'main',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const savedConfig = await gitlabService.getConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load GitLab config:', error);
      toast({
        title: t('toast.error'),
        description: 'Failed to load GitLab configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
      await gitlabService.updateConfig(config);
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

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return token.substring(0, 4) + '•'.repeat(token.length - 8) + token.substring(token.length - 4);
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
    <Card>
      <CardHeader>
        <CardTitle>{t('gitlab.config')}</CardTitle>
        <CardDescription>
          Configure GitLab integration for merge requests and CI/CD pipelines
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To use GitLab integration, you need a Personal Access Token with 'api' scope.
            You can create one in GitLab Settings → Access Tokens.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="gitlab-url">{t('gitlab.gitlabUrl')}</Label>
          <Input
            id="gitlab-url"
            type="url"
            value={config.gitlabUrl || ''}
            onChange={(e) => setConfig({ ...config, gitlabUrl: e.target.value })}
            placeholder="https://gitlab.com"
          />
          <p className="text-sm text-muted-foreground">
            URL of your GitLab instance (default: https://gitlab.com)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlab-token">{t('gitlab.personalAccessToken')}</Label>
          <div className="flex gap-2">
            <Input
              id="gitlab-token"
              type={showToken ? 'text' : 'password'}
              value={config.pat || ''}
              onChange={(e) => setConfig({ ...config, pat: e.target.value })}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? 'Hide' : 'Show'}
            </Button>
          </div>
          {config.pat && !showToken && (
            <p className="text-sm text-muted-foreground font-mono">
              Current token: {maskToken(config.pat)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="gitlab-branch">{t('gitlab.defaultBranch')}</Label>
          <Input
            id="gitlab-branch"
            type="text"
            value={config.defaultBranch || ''}
            onChange={(e) => setConfig({ ...config, defaultBranch: e.target.value })}
            placeholder="main"
          />
          <p className="text-sm text-muted-foreground">
            Default target branch for merge requests
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

        {config.pat && (
          <Alert className="mt-4">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              GitLab integration is configured and ready to use.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}