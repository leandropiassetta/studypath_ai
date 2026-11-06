import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'test_support.dart';

import 'package:studypath_app/models/explanation.dart';
import 'package:studypath_app/services/api_client.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const quiz = {
  'id': 'quiz',
  'slug': 'demo-matematica',
  'title': 'Simulado de Matemática',
  'questions': [
    {
      'id': 'q1',
      'topic': {'id': 't1', 'name': 'Equações'},
      'statement': 'x + 2 = 5?',
      'options': [
        {'key': 'A', 'text': '2'},
        {'key': 'B', 'text': '3'},
      ],
      'difficulty': 'medium',
    },
    {
      'id': 'q2',
      'topic': {'id': 't2', 'name': 'Geometria'},
      'statement': 'Soma dos ângulos?',
      'options': [
        {'key': 'A', 'text': '90'},
        {'key': 'B', 'text': '180'},
      ],
      'difficulty': 'hard',
    },
  ],
};

Map<String, Object?> result(String attemptId) => {
  'attemptId': attemptId,
  'quizId': 'quiz',
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

/// Answers q1=A (wrong) and q2=B (right) and submits, landing on the result screen.
Future<void> reachResult(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 4000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> answerAndSubmit(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('option-q1-A')));
  await tester.tap(find.byKey(const Key('option-q2-B')));
  await tester.pump();
  await tester.tap(find.byKey(const Key('submit-button')));
  await tester.pumpAndSettle();
}

Future<void> pumpApp(WidgetTester tester, MockClient mock) async {
  await reachResult(tester);
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
}

void main() {
  test('Explanation parses the optional usage-limit notice', () {
    final e = Explanation.fromJson({
      'questionId': 'q',
      'explanation': 'e',
      'source': 'reference',
      'notice': 'n',
    });
    expect(e.notice, 'n');
    expect(
      Explanation.fromJson({
        'questionId': 'q',
        'explanation': 'e',
        'source': 'llm',
      }).notice,
      isNull,
    );
  });

  test('Explanation parses and flags AI vs reference', () {
    final ai = Explanation.fromJson({
      'questionId': 'q',
      'explanation': 'e',
      'source': 'llm',
    });
    final ref = Explanation.fromJson({
      'questionId': 'q',
      'explanation': 'e',
      'source': 'reference',
    });
    expect(ai.isAi, isTrue);
    expect(ref.isAi, isFalse);
  });

  testWidgets(
    'quiz shows difficulty labels and progress that follows the answers',
    (tester) async {
      await pumpApp(tester, MockClient((_) async => json(quiz)));
      expect(find.byKey(const Key('difficulty-q1')), findsOneWidget);
      expect(find.text('Média'), findsOneWidget);
      expect(find.text('Difícil'), findsOneWidget);

      double progress() => tester
          .widget<LinearProgressIndicator>(find.byKey(const Key('progress')))
          .value!;
      expect(progress(), 0);
      await tester.tap(find.byKey(const Key('option-q1-A')));
      await tester.pump();
      expect(progress(), 0.5);
      expect(find.text('Enviar respostas (1/2)'), findsOneWidget);
      await tester.tap(find.byKey(const Key('option-q2-B')));
      await tester.pump();
      expect(progress(), 1);
    },
  );

  group('explanations', () {
    MockClient mockWith(
      Future<http.Response> Function(http.Request) onExplain,
    ) => MockClient((req) {
      if (req.url.path.endsWith('/explanations')) return onExplain(req);
      if (req.method == 'POST') return Future.value(json(result('att-1'), 201));
      return Future.value(json(quiz));
    });

    testWidgets(
      'only wrong answers offer an explanation; AI text is labelled',
      (tester) async {
        late http.Request captured;
        await pumpApp(
          tester,
          mockWith((req) async {
            captured = req;
            return json({
              'questionId': 'q1',
              'explanation': 'Texto da IA',
              'source': 'llm',
            });
          }),
        );
        await answerAndSubmit(tester);

        expect(find.byKey(const Key('explain-q1')), findsOneWidget);
        expect(find.byKey(const Key('explain-q2')), findsNothing);

        await tester.tap(find.byKey(const Key('explain-q1')));
        await tester.pumpAndSettle();
        expect(find.text('Texto da IA'), findsOneWidget);
        expect(find.text('Explicação gerada por IA'), findsOneWidget);
        expect(captured.url.path, '/api/v1/attempts/att-1/explanations');
        expect(jsonDecode(captured.body), {'questionId': 'q1'});
        // The score is untouched by explanations.
        expect(find.text('50%'), findsOneWidget);
      },
    );

    testWidgets('reference fallback is labelled differently', (tester) async {
      await pumpApp(
        tester,
        mockWith(
          (_) async => json({
            'questionId': 'q1',
            'explanation': 'Subtraia 2.',
            'source': 'reference',
          }),
        ),
      );
      await answerAndSubmit(tester);
      await tester.tap(find.byKey(const Key('explain-q1')));
      await tester.pumpAndSettle();
      expect(find.text('Explicação de referência'), findsOneWidget);
      expect(find.text('Explicação gerada por IA'), findsNothing);
    });

    testWidgets(
      'a usage-limit notice explains why the reference text is shown',
      (tester) async {
        await pumpApp(
          tester,
          mockWith(
            (_) async => json({
              'questionId': 'q1',
              'explanation': 'Subtraia 2.',
              'source': 'reference',
              'notice': 'Limite de explicações por IA atingido (24 h).',
            }),
          ),
        );
        await answerAndSubmit(tester);
        await tester.tap(find.byKey(const Key('explain-q1')));
        await tester.pumpAndSettle();
        expect(find.text('Explicação de referência'), findsOneWidget);
        expect(find.byKey(const Key('notice-q1')), findsOneWidget);
        expect(
          find.text('Limite de explicações por IA atingido (24 h).'),
          findsOneWidget,
        );
      },
    );

    testWidgets('no notice is shown for a normal explanation', (tester) async {
      await pumpApp(
        tester,
        mockWith(
          (_) async =>
              json({'questionId': 'q1', 'explanation': 'ok', 'source': 'llm'}),
        ),
      );
      await answerAndSubmit(tester);
      await tester.tap(find.byKey(const Key('explain-q1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('notice-q1')), findsNothing);
    });

    testWidgets('shows a spinner while loading, then error with retry', (
      tester,
    ) async {
      final pending = Completer<http.Response>();
      var calls = 0;
      await pumpApp(
        tester,
        mockWith((_) {
          calls++;
          if (calls == 1) return pending.future;
          return Future.value(
            json({'questionId': 'q1', 'explanation': 'ok', 'source': 'llm'}),
          );
        }),
      );
      await answerAndSubmit(tester);

      await tester.tap(find.byKey(const Key('explain-q1')));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      pending.complete(
        json({
          'error': {
            'code': 'INTERNAL_ERROR',
            'message': 'Erro interno',
            'details': [],
          },
        }, 500),
      );
      await tester.pumpAndSettle();
      expect(find.text('Erro interno'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);

      await tester.tap(find.byKey(const Key('explain-q1')));
      await tester.pumpAndSettle();
      expect(find.text('ok'), findsOneWidget);
      expect(calls, 2);
    });
  });

  testWidgets(
    'navigation: quiz -> result -> recommendations -> back -> new quiz is reset',
    (tester) async {
      final requestIds = <String>[];
      final mock = MockClient((req) async {
        if (req.method == 'POST') {
          requestIds.add((jsonDecode(req.body) as Map)['requestId'] as String);
          return json(result('att-${requestIds.length}'), 201);
        }
        if (req.url.path.endsWith('/recommendations')) {
          return json({
            'studentId': 's',
            'status': 'ON_TRACK',
            'evaluatedAttempts': 1,
            'topics': <Object>[],
          });
        }
        return json(quiz);
      });
      await pumpApp(tester, mock);
      await answerAndSubmit(tester);
      expect(find.text('Resultado'), findsOneWidget);

      await tester.tap(find.byKey(const Key('recommendations-button')));
      await tester.pumpAndSettle();
      expect(find.text('Recomendações'), findsOneWidget);
      expect(find.textContaining('Excelente'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('Resultado'), findsOneWidget);

      await tester.tap(find.byKey(const Key('retake-button')));
      await tester.pumpAndSettle();
      expect(find.text('Simulado de Matemática'), findsOneWidget);
      // Fresh attempt: answers cleared, submit disabled again.
      expect(find.text('Enviar respostas (0/2)'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('submit-button')))
            .onPressed,
        isNull,
      );

      // Answering again is a new intent, so a new requestId.
      await answerAndSubmit(tester);
      expect(requestIds, hasLength(2));
      expect(requestIds[0], isNot(requestIds[1]));
    },
  );
}
