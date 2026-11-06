import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/auth_screen.dart';
import 'screens/quiz_screen.dart';
import 'services/api_client.dart';
import 'services/session_controller.dart';

void main() {
  final api = ApiClient(baseUrl: apiBaseUrl);
  runApp(StudyPathApp(api: api, session: SessionController(api)));
}

ThemeData _theme(Brightness brightness) => ThemeData(
  colorSchemeSeed: Colors.indigo,
  brightness: brightness,
  useMaterial3: true,
);

class StudyPathApp extends StatelessWidget {
  const StudyPathApp({super.key, required this.api, required this.session});

  final ApiClient api;
  final SessionController session;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'StudyPath AI',
    theme: _theme(Brightness.light),
    darkTheme: _theme(Brightness.dark),
    themeMode: ThemeMode.system,
    home: ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final current = session.session;
        if (current == null) return AuthScreen(controller: session);
        // The key makes every login start from a fresh quiz, never a previous student's state.
        return QuizScreen(
          key: ValueKey(current.student.id),
          api: api,
          slug: demoQuizSlug,
          studentName: current.student.name,
          onLogout: session.logout,
        );
      },
    ),
  );
}
