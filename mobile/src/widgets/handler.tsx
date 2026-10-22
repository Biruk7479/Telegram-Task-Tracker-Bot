// Headless task for the home-screen widgets: draws them when Android asks
// (added, resized, every 30 minutes) and handles taps without opening the app.
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { mark, tapAction } from '../lib/api';
import { applyLocally, replaceOccurrence, myOpenList } from '../lib/local';
import { loadCachedBoard, loadSession } from '../lib/storage';
import { loadSurfaceStyle, loadThemeMode, type SurfaceStyle, type ThemeMode } from '../lib/theme';
import { loadWidgetData } from './data';
import { syncNotifications } from '../lib/notify';
import { isWidgetName, renderWidget, WIDGET_NAMES } from './render';
import type { WidgetData } from './components';

// Redraw every other placed widget from the same fresh data.
async function redrawOthers(except: string, data: WidgetData, mode: ThemeMode, style: SurfaceStyle) {
  for (const name of WIDGET_NAMES) {
    if (name === except) continue;
    await requestWidgetUpdate({
      widgetName: name,
      renderWidget: async (info) => {
        const own = name === 'Month' ? await loadWidgetData({ withMonth: true }) : data;
        return renderWidget(name, own, info, mode, style);
      },
    });
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData } = props;
  const name = widgetInfo.widgetName;
  if (!isWidgetName(name) || widgetAction === 'WIDGET_DELETED') return;
  const mode = await loadThemeMode();
  const style = await loadSurfaceStyle();

  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE') {
    const session = await loadSession();
    const cached = (await loadCachedBoard())?.board;
    const taskId = String(clickActionData?.taskId ?? '');
    const date = String(clickActionData?.date ?? '');
    const target = session && cached
      ? myOpenList(cached, session.user.telegramId).find((o) => o.taskId === taskId && o.date === date && o.status === 'pending')
      : undefined;

    if (session && cached && target) {
      const action = tapAction(target);
      // Show the result straight away, then confirm with the server.
      props.renderWidget(renderWidget(name, {
        board: replaceOccurrence(cached, applyLocally(target, action)), meId: session.user.telegramId,
      }, widgetInfo, mode, style));
      try {
        await mark(session, { taskId, date, action });
      } catch {
        // The fresh board below shows the real state if the mark failed.
      }
    }
  }

  const data = await loadWidgetData({ withMonth: name === 'Month' });
  props.renderWidget(renderWidget(name, data, widgetInfo, mode, style));

  // Background updates also keep reminders and partner alerts current.
  const session = await loadSession();
  if (session && data.board && !data.offline) await syncNotifications(session, data.board);

  // A tap changes what every widget shows; keep them in step.
  if (widgetAction === 'WIDGET_CLICK') await redrawOthers(name, data, mode, style);
}
