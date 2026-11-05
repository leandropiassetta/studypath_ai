import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/quiz_screen.dart';
import 'services/api_client.dart';

void main() {
  runApp(
    StudyPathApp(
      api: ApiClient(baseUrl: apiBaseUrl, studentId: demoStudentId),
    ),
  );
}

class StudyPathApp extends StatelessWidget {
  const StudyPathApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'StudyPath AI',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    home: QuizScreen(api: api, slug: demoQuizSlug),
  );
}
