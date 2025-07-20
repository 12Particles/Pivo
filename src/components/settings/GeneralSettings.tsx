import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function GeneralSettings() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState(i18n.language);
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') || 'en';
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedAutoSave = localStorage.getItem('autoSave') !== 'false';
    const savedNotifications = localStorage.getItem('notifications') !== 'false';
    
    setLanguage(savedLanguage);
    setTheme(savedTheme);
    setAutoSave(savedAutoSave);
    setNotifications(savedNotifications);
    
    // Apply saved language
    i18n.changeLanguage(savedLanguage);
  }, [i18n]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('language', language);
    localStorage.setItem('theme', theme);
    localStorage.setItem('autoSave', autoSave.toString());
    localStorage.setItem('notifications', notifications.toString());
    
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