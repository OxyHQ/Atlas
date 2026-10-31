import { useCallback, useSyncExternalStore } from 'react';
import type { OxyServices } from '@oxy.so/core';

/** Subscribe to the session facts used to associate reviews with a bearer. */
export function useReviewSession(oxyServices: OxyServices) {
  const http = oxyServices.http;
  const subscribe = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const readEpoch = useCallback(() => http.getSessionEpoch(), [http]);
  const readSubject = useCallback(() => oxyServices.session.userId, [oxyServices]);
  const epoch = useSyncExternalStore(subscribe, readEpoch, readEpoch);
  const subject = useSyncExternalStore(subscribe, readSubject, readSubject);
  return { epoch, subject };
}
