import { useCallback, useMemo, useRef } from 'react';
import { AliaChatSheet, type AliaChatSheetRef } from '@alia.onl/sdk';
import { AliaAvatarIcon } from '@alia.onl/sdk/avatar';
import { Button } from '@oxy.so/bloom/button';
import { useAuth } from '@oxy.so/services';
import { useTranslation } from '@/lib/i18n';

interface AskAliaProps {
  /** What the person is looking at, in a sentence, appended to the app description Alia is given. */
  screenContext?: string;
}

/**
 * The "Ask Alia" button and the chat sheet it opens.
 *
 * The store is public, so the button is always there; pressing it signed out
 * opens the in-app Oxy sign-in dialog rather than a sheet that could not call
 * Alia. The sheet itself is mounted only once the session can use the private
 * API.
 */
export function AskAlia({ screenContext }: AskAliaProps) {
  const { t } = useTranslation();
  const { canUsePrivateApi, signIn } = useAuth();
  const chatRef = useRef<AliaChatSheetRef>(null);

  const welcomeSuggestions = useMemo(
    () => [
      { id: 'discover', text: t('alia.suggestion.discover') },
      { id: 'compare', text: t('alia.suggestion.compare') },
      { id: 'publish', text: t('alia.suggestion.publish') },
    ],
    [t],
  );

  const clientContext = screenContext
    ? `${t('alia.clientContext')} ${screenContext}`
    : t('alia.clientContext');

  const handleAskAlia = useCallback(() => {
    if (canUsePrivateApi) chatRef.current?.present();
    else void signIn();
  }, [canUsePrivateApi, signIn]);

  return (
    <>
      <Button size="sm" appearance="outline" leadingIcon={AliaAvatarIcon} onPress={handleAskAlia}>
        {t('alia.ask')}
      </Button>
      {canUsePrivateApi && (
        <AliaChatSheet
          ref={chatRef}
          clientContext={clientContext}
          welcomeSuggestions={welcomeSuggestions}
        />
      )}
    </>
  );
}
