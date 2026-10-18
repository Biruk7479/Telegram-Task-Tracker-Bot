// Entry point: the Expo Router app, plus the headless task that draws and
// handles taps on the Android home-screen widgets (it runs even when the app
// is closed).
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/handler';

registerWidgetTaskHandler(widgetTaskHandler);
