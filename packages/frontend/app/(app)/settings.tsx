import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { Button } from '@oxyhq/bloom/button';
import { SettingsListGroup, SettingsListItem } from '@oxyhq/bloom/settings-list';
import { useBloomTheme } from '@oxyhq/bloom/theme';
import { useAuth } from '@oxyhq/services';
import { getNormalizedUserHandle } from '@oxyhq/core';
import { useTranslation } from '@/lib/i18n';

/**
 * Settings.
 *
 * The rows are Bloom's `SettingsListGroup` / `SettingsListItem` — the same
 * components Mention's settings screen is built from — so the two look and
 * behave alike without either app owning a private copy. Anything that should
 * change here for every Oxy app changes in Bloom.
 *
 * Signed out is a first-class state, not an error: Atlas is browsable without an
 * account, so this screen offers a way in rather than assuming one.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const { mode, setMode } = useBloomTheme();

  const handle = (user && getNormalizedUserHandle(user)) || '';
  const displayName = user?.name?.displayName?.trim() || handle;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('settings.title') }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: insets.bottom + 32, gap: 8 }}
      >
        {isAuthenticated ? (
          <View className="flex-row items-center gap-4 px-6 py-4">
            <Avatar source={user?.avatar} variant="thumb" size={56} name={displayName} />
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                {displayName}
              </Text>
              {handle ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  @{handle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="gap-3 px-6 py-4">
            <Text className="text-base text-muted-foreground">{t('settings.signedOut')}</Text>
            <Button variant="secondary" onPress={() => void signIn()}>
              {t('settings.signIn')}
            </Button>
          </View>
        )}

        <SettingsListGroup title={t('settings.appearance')}>
          <SettingsListItem
            title={t('settings.theme')}
            description={t('settings.themeHelp')}
            value={t(`settings.theme.${mode}`)}
            // Cycles rather than opening a picker: three options do not earn a
            // second screen, and the current one is always on the row.
            onPress={() => setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')}
          />
        </SettingsListGroup>

        <SettingsListGroup title={t('settings.store')}>
          <SettingsListItem
            title={t('settings.browse')}
            showChevron
            onPress={() => router.replace('/')}
          />
          <SettingsListItem
            title={t('settings.publishYourApp')}
            description={t('settings.publishHelp')}
            showChevron
            onPress={() => Linking.openURL('https://console.oxy.so')}
          />
        </SettingsListGroup>

        <SettingsListGroup title={t('settings.about')} footer={t('settings.aboutFooter')}>
          <SettingsListItem
            title={t('settings.oxy')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so')}
          />
          <SettingsListItem
            title={t('settings.privacy')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so/privacy')}
          />
          <SettingsListItem
            title={t('settings.terms')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so/terms')}
          />
        </SettingsListGroup>

        {isAuthenticated ? (
          <SettingsListGroup>
            <SettingsListItem
              title={t('settings.signOut')}
              destructive
              onPress={() => void signOut()}
            />
          </SettingsListGroup>
        ) : null}
      </ScrollView>
    </>
  );
}
