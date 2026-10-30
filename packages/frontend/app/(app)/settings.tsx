import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@oxy.so/bloom/avatar';
import { Button } from '@oxy.so/bloom/button';
import { GroupedSection, GroupedSectionItem } from '@oxy.so/bloom/grouped-section';
import { useBloomTheme } from '@oxy.so/bloom/theme';
import { useAuth } from '@oxy.so/services/ui/client';
import { getNormalizedUserHandle } from '@oxy.so/core';
import { DetailPage } from '@/components/page';
import { useTranslation } from '@/lib/i18n';

/**
 * Settings.
 *
 * The rows are Bloom's `GroupedSection` / `GroupedSectionItem` — the same
 * components Mention's settings screen is built from — so the two look and
 * behave alike without either app owning a private copy. Anything that should
 * change here for every Oxy app changes in Bloom.
 *
 * Signed out is a first-class state, not an error: Atlas is browsable without an
 * account, so this screen offers a way in rather than assuming one.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const { mode, setMode } = useBloomTheme();

  const handle = (user && getNormalizedUserHandle(user)) || '';
  const displayName = user?.name?.displayName?.trim() || handle;

  return (
    <DetailPage title={t('settings.title')}>
      <View className="gap-2 px-4 py-4">
        {isAuthenticated ? (
          <View className="flex-row items-center gap-4 px-2 py-4">
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
          <View className="gap-3 px-2 py-4">
            <Text className="text-base text-muted-foreground">{t('settings.signedOut')}</Text>
            <Button appearance="outline" tone="neutral" onPress={() => void signIn()}>
              {t('settings.signIn')}
            </Button>
          </View>
        )}

        <GroupedSection title={t('settings.appearance')}>
          <GroupedSectionItem
            title={t('settings.theme')}
            description={t('settings.themeHelp')}
            value={t(`settings.theme.${mode}`)}
            // Cycles rather than opening a picker: three options do not earn a
            // second screen, and the current one is always on the row.
            onPress={() =>
              setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')
            }
          />
        </GroupedSection>

        <GroupedSection title={t('settings.store')}>
          <GroupedSectionItem
            title={t('settings.browse')}
            showChevron
            onPress={() => router.replace('/')}
          />
          <GroupedSectionItem
            title={t('settings.publishYourApp')}
            description={t('settings.publishHelp')}
            showChevron
            onPress={() => Linking.openURL('https://console.oxy.so')}
          />
        </GroupedSection>

        <GroupedSection title={t('settings.about')} footer={t('settings.aboutFooter')}>
          <GroupedSectionItem
            title={t('settings.oxy')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so')}
          />
          <GroupedSectionItem
            title={t('settings.privacy')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so/privacy')}
          />
          <GroupedSectionItem
            title={t('settings.terms')}
            showChevron
            onPress={() => Linking.openURL('https://oxy.so/terms')}
          />
        </GroupedSection>

        {isAuthenticated ? (
          <GroupedSection>
            <GroupedSectionItem
              title={t('settings.signOut')}
              destructive
              onPress={() => void signOut()}
            />
          </GroupedSection>
        ) : null}
      </View>
    </DetailPage>
  );
}
