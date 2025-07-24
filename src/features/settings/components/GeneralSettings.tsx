import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/contexts/SettingsContext";

export function GeneralSettings() {
  const { t, i18n } = useTranslation();
  const { 
    theme, 
    language, 
    autoSave, 
    notifications,
    setTheme,
    setLanguage,
    setAutoSave,
    setNotifications
  } = useSettings();

  // Apply language on mount and when it changes
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  const handleSave = () => {
    // Settings are automatically persisted by zustand persist middleware
    toast({
      title: t('common.success'),
      description: t('settings.settingsSaved'),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearanceSettings')}</CardTitle>
          <CardDescription>{t('settings.appearanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">{t('common.theme')}</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t('common.language')}</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">{t('settings.language.zh')}</SelectItem>
                <SelectItem value="en">{t('settings.language.en')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.editorSettings')}</CardTitle>
          <CardDescription>{t('settings.editorDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save">{t('settings.autoSave')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.autoSaveDescription')}
              </p>
            </div>
            <Switch
              id="auto-save"
              checked={autoSave}
              onCheckedChange={setAutoSave}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">{t('common.notifications')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notificationsDescription')}
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>{t('settings.saveSettings')}</Button>
      </div>
    </div>
  );
}