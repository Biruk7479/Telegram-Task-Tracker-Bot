// Called by the app after every refresh, so widgets update as soon as the app
// sees new data instead of waiting for Android's 30-minute timer.
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { Session } from '../lib/storage';
import type { Board } from '../lib/types';
import { loadMonth } from './data';
import { renderWidget, WIDGET_NAMES } from './render';

export function refreshWidgets(session: Session, board: Board) {
  if (Platform.OS !== 'android') return;
  const data = { board, meId: session.user.telegramId };
  for (const name of WIDGET_NAMES) {
    requestWidgetUpdate({
      widgetName: name,
      renderWidget: async (info) =>
        renderWidget(name, name === 'Month' ? { ...data, month: await loadMonth(session, board.today) } : data, info),
    }).catch(() => {});
  }
}
