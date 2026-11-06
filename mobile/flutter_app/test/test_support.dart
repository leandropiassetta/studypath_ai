import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:studypath_app/main.dart';
import 'package:studypath_app/models/auth_session.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

AuthSession fakeSession({String id = 's', String name = 'Aluna Teste'}) =>
    AuthSession(
      token: 't' * 43,
      expiresAt: DateTime.utc(2099),
      student: Student(id: id, name: name, email: 'aluna@teste.dev'),
    );

/// The whole app, already logged in (the quiz is the first screen).
StudyPathApp loggedInApp(ApiClient api) => StudyPathApp(
  api: api,
  session: SessionController(api, initial: fakeSession()),
);

/// Puts the simulado list (what the subject picker loads) in front of any test client; every other
/// request goes to [inner] untouched.
http.Client withQuizList(
  http.Client inner, {
  String slug = 'demo-matematica',
  String title = 'Simulado de Matemática',
}) => _QuizListClient(inner, slug, title);

class _QuizListClient extends http.BaseClient {
  _QuizListClient(this._inner, this._slug, this._title);

  final http.Client _inner;
  final String _slug;
  final String _title;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (request.method == 'GET' &&
        request.url.path.endsWith('/api/v1/quizzes')) {
      final body = jsonEncode([
        {
          'id': 'quiz-id',
          'slug': _slug,
          'title': _title,
          'questionCount': 2,
          'topics': [
            {'id': 't1', 'name': 'Equações'},
          ],
        },
      ]);
      return Future.value(
        http.StreamedResponse(
          Stream.value(utf8.encode(body)),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      );
    }
    return _inner.send(request);
  }
}

/// From the subject picker, opens the simulado of [slug].
Future<void> openQuizFromPicker(
  WidgetTester tester, [
  String slug = 'demo-matematica',
]) async {
  await tester.tap(find.byKey(Key('quiz-card-$slug')));
  await tester.pumpAndSettle();
}
