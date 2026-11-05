/// Build-time configuration, e.g.
/// `flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3000`.
/// Android emulator: use `http://10.0.2.2:3000`.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3000',
);

/// Fictional demo student seeded by the backend (see README).
const String demoStudentId = String.fromEnvironment(
  'DEMO_STUDENT_ID',
  defaultValue: '55555555-5555-4555-8555-555555555555',
);

const String demoQuizSlug = 'demo-matematica';
