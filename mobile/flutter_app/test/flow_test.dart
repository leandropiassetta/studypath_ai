import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'test_support.dart';

import 'package:studypath_app/services/api_client.dart';

const _quiz = {
  'id': 'quiz-1',
  'slug': 'demo-matematica',
  'title': 'Simulado de Matemática',
  'questions': [
    {
      'id': 'q1',
      'topic': {'id': 't1', 'name': 'Equações'},
      'statement': 'Quanto é x se x + 2 = 5?',
      'options': [
        {'key': 'A', 'text': '2'},
        {'key': 'B', 'text': '3'},
      ],
      'difficulty': 'easy',
    },
    {
      'id': 'q2',
      'topic': {'id': 't2', 'name': 'Geometria'},
      'statement': 'Soma dos ângulos de um triângulo?',
      'options': [
        {'key': 'A', 'text': '90'},
        {'key': 'B', 'text': '180'},
      ],
      'difficulty': 'easy',
    },
  ],
};

const _result = {
  'attemptId': 'att-1',
  'quizId': 'quiz-1',
  'correctCount': 1,
  'totalCount': 2,
  'scorePct': 50,
  'topicResults': [
    {
      'topicId': 't1',
      'topicName': 'Equações',
      'correctCount': 0,
      'totalCount': 1,
      'accuracyPct': 0,
    },
    {
      'topicId': 't2',
      'topicName': 'Geometria',
      'correctCount': 1,
      'totalCount': 1,
      'accuracyPct': 100,
    },
  ],
  'answers': [
    {
      'questionId': 'q1',
      'selectedOption': 'A',
      'correctOption': 'B',
      'isCorrect': false,
      'referenceExplanation': 'Subtraia 2.',
    },
    {
      'questionId': 'q2',
      'selectedOption': 'B',
      'correctOption': 'B',
      'isCorrect': true,
      'referenceExplanation': 'Sempre 180.',
    },
  ],
};

const _recs = {
  'studentId': 's',
  'status': 'NEEDS_REVIEW',
  'evaluatedAttempts': 1,
  'topics': [
    {
      'topicId': 't1',
      'topicName': 'Equações',
      'priority': 'HIGH',
      'correctCount': 0,
      'answeredCount': 1,
      'accuracyPct': 0,
      'status': 'AVAILABLE',
      'suggestedQuestions': [
        {
          'id': 'x1',
          'statement': 'Quanto é x se x - 7 = 1?',
          'options': [
            {'key': 'A', 'text': '6'},
            {'key': 'B', 'text': '8'},
          ],
          'difficulty': 'easy',
        },
      ],
    },
  ],
};

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  testWidgets(
    'full flow: answer, submit with retry on failure, result, recommendations',
    (tester) async {
      tester.view.physicalSize = const Size(800, 4000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final postedRequestIds = <String>[];
      var posts = 0;
      final mock = MockClient((req) async {
        if (req.method == 'GET' &&
            req.url.path.endsWith('/quizzes/demo-matematica')) {
          return _json(_quiz);
        }
        if (req.method == 'POST' && req.url.path.endsWith('/attempts')) {
          postedRequestIds.add(
            (jsonDecode(req.body) as Map)['requestId'] as String,
          );
          posts++;
          if (posts == 1) throw http.ClientException('offline');
          return _json(_result, 201);
        }
        if (req.url.path.endsWith('/recommendations')) return _json(_recs);
        return _json({
          'error': {'code': 'NOT_FOUND', 'message': 'x', 'details': []},
        }, 404);
      });

      await tester.pumpWidget(
        loggedInApp(
          ApiClient(
            baseUrl: 'http://api.test',
            studentId: 's',
            client: withQuizList(mock),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await openQuizFromPicker(tester);

      expect(find.text('Simulado de Matemática'), findsOneWidget);
      expect(find.textContaining('Quanto é x se x + 2 = 5?'), findsOneWidget);

      // Submit is disabled until every question is answered.
      FilledButton submit() =>
          tester.widget<FilledButton>(find.byKey(const Key('submit-button')));
      expect(submit().onPressed, isNull);

      await tester.tap(find.byKey(const Key('option-q1-A')));
      await tester.pump();
      expect(submit().onPressed, isNull);
      await tester.tap(find.byKey(const Key('option-q2-B')));
      await tester.pump();
      expect(submit().onPressed, isNotNull);

      // First attempt fails: error shown, answers kept, retry available.
      await tester.tap(find.byKey(const Key('submit-button')));
      await tester.pumpAndSettle();
      expect(find.text('Não foi possível conectar à API.'), findsOneWidget);
      expect(find.text('Tentar enviar novamente'), findsOneWidget);

      // Retry reuses the same requestId (CA-10) and succeeds.
      await tester.tap(find.byKey(const Key('submit-button')));
      await tester.pumpAndSettle();
      expect(postedRequestIds, hasLength(2));
      expect(postedRequestIds[0], postedRequestIds[1]);

      expect(find.byKey(const Key('score')), findsOneWidget);
      expect(find.text('50%'), findsOneWidget);
      expect(find.text('1 de 2 questões corretas'), findsOneWidget);
      expect(find.textContaining('Correta: B'), findsOneWidget);

      await tester.tap(find.byKey(const Key('recommendations-button')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Equações • prioridade alta'), findsOneWidget);
      expect(find.textContaining('Quanto é x se x - 7 = 1?'), findsOneWidget);
    },
  );

  testWidgets('load failure shows an error and retry loads the quiz', (
    tester,
  ) async {
    var calls = 0;
    final mock = MockClient((_) async {
      calls++;
      if (calls == 1) {
        return _json({
          'error': {
            'code': 'INTERNAL_ERROR',
            'message': 'Erro interno',
            'details': [],
          },
        }, 500);
      }
      return _json(_quiz);
    });
    await tester.pumpWidget(
      loggedInApp(
        ApiClient(
          baseUrl: 'http://api.test',
          studentId: 's',
          client: withQuizList(mock),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await openQuizFromPicker(tester);
    expect(find.text('Erro interno'), findsOneWidget);

    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Simulado de Matemática'), findsOneWidget);
  });
}
