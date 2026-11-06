import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/auth_screen.dart';
import 'screens/quiz_picker_screen.dart';
import 'screens/teacher_queue_screen.dart';
import 'services/api_client.dart';
import 'services/session_controller.dart';
import 'services/theme_controller.dart';

void main() {
  final api = ApiClient(baseUrl: apiBaseUrl);
  runApp(StudyPathApp(api: api, session: SessionController(api)));
}

ThemeData _buildTheme(Brightness brightness) => ThemeData(
  colorSchemeSeed: Colors.indigo,
  brightness: brightness,
  useMaterial3: true,
);

class StudyPathApp extends StatefulWidget {
  const StudyPathApp({
    super.key,
    required this.api,
    required this.session,
    this.theme,
  });

  final ApiClient api;
  final SessionController session;

  /// Injectable for tests; by default it starts from the system theme and then keeps the choice.
  final ThemeController? theme;

  @override
  State<StudyPathApp> createState() => _StudyPathAppState();
}

class _StudyPathAppState extends State<StudyPathApp> {
  late final ThemeController _theme =
      widget.theme ?? ThemeController.fromSystem();

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _theme,
    builder: (context, _) => MaterialApp(
      title: 'StudyPath AI',
      theme: _buildTheme(Brightness.light),
      darkTheme: _buildTheme(Brightness.dark),
      themeMode: _theme.mode,
      // Every route sits below this, so any screen can show the theme button.
      builder: (context, child) => ThemeScope(
        controller: _theme,
        child: child ?? const SizedBox.shrink(),
      ),
      home: ListenableBuilder(
        listenable: widget.session,
        builder: (context, _) {
          final current = widget.session.session;
          if (current == null) return AuthScreen(controller: widget.session);
          // Teachers get the doubt queue; students pick a subject. The server enforces the same rule.
          if (current.student.isTeacher) {
            return TeacherQueueScreen(
              key: ValueKey(current.student.id),
              api: widget.api,
              teacherName: current.student.name,
              onLogout: widget.session.logout,
            );
          }
          // The key makes every login start from a fresh screen, never a previous student's state.
          return QuizPickerScreen(
            key: ValueKey(current.student.id),
            api: widget.api,
            studentName: current.student.name,
            onLogout: widget.session.logout,
          );
        },
      ),
    ),
  );
}
