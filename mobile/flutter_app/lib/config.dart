/// Build-time configuration, e.g.
/// `flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3000`.
/// Android emulator: use `http://10.0.2.2:3000`.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3000',
);
