import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/attempt_result.dart';
import 'package:studypath_app/models/quiz.dart';
import 'package:studypath_app/screens/quiz_screen.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/screens/result_screen.dart';
import 'package:studypath_app/services/api_client.dart';

ApiClient apiFor(MockClient mock) =>
    ApiClient(baseUrl: 'http://api.test', studentId: 's', client: mock);

Widget app(Widget home) => MaterialApp(home: home);

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> recs(String status, [List<Object> topics = const []]) => {
  'studentId': 's',
  'status': status,
  'evaluatedAttempts': status == 'NO_HISTORY' ? 0 : 1,
  'topics': topics,
};

Map<String, Object?> topic({
  String priority = 'HIGH',
  required String status,
  List<Object> suggested = const [],
  String? message,
}) => {
  'topicId': 't',
  'topicName': 'Equações',
  'priority': priority,
  'correctCount': 1,
  'answeredCount': 4,
  'accuracyPct': 25,
  'status': status,
  'message': ?message,
  'suggestedQuestions': suggested,
};

void main() {
  group('loading and error states (test 18)', () {
    testWidgets('quiz screen shows a spinner while loading', (tester) async {
      final pending = Completer<http.Response>();
      await tester.pumpWidget(
        app(
          QuizScreen(
            api: apiFor(MockClient((_) => pending.future)),
            slug: 'demo',
          ),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      pending.complete(
        json({
          'error': {'code': 'X', 'message': 'falhou', 'details': []},
        }, 500),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('falhou'), findsOneWidget);
    });

    testWidgets('recommendations screen: spinner, error, then retry succeeds', (
      tester,
    ) async {
      final first = Completer<http.Response>();
      var calls = 0;
      final mock = MockClient((_) {
        calls++;
        return calls == 1
            ? first.future
            : Future.value(json(recs('NO_HISTORY')));
      });
      await tester.pumpWidget(app(RecommendationsScreen(api: apiFor(mock))));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      first.completeError(http.ClientException('offline'));
      await tester.pumpAndSettle();
      expect(find.text('Não foi possível conectar à API.'), findsOneWidget);

      await tester.tap(find.text('Tentar novamente'));
      await tester.pumpAndSettle();
      expect(
        find.text('Faça um simulado para receber recomendações.'),
        findsOneWidget,
      );
      expect(calls, 2);
    });

    testWidgets('a malformed response leaves loading and offers retry', (
      tester,
    ) async {
      final mock = MockClient((_) async => json({'oops': true}));
      await tester.pumpWidget(app(RecommendationsScreen(api: apiFor(mock))));
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Resposta inesperada da API.'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
    });

    testWidgets(
      'submit shows progress, blocks double taps and reuses requestId on retry (CA-10)',
      (tester) async {
        tester.view.physicalSize = const Size(800, 4000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);

        final ids = <String>[];
        final pending = Completer<http.Response>();
        var posts = 0;
        final mock = MockClient((req) {
          if (req.method == 'GET') {
            return Future.value(
              json({
                'id': 'quiz',
                'slug': 'demo',
                'title': 'Simulado',
                'questions': [
                  {
                    'id': 'q1',
                    'topic': {'id': 't', 'name': 'Equações'},
                    'statement': 'x?',
                    'options': [
                      {'key': 'A', 'text': '1'},
                      {'key': 'B', 'text': '2'},
                    ],
                    'difficulty': 'easy',
                  },
                ],
              }),
            );
          }
          ids.add((jsonDecode(req.body) as Map)['requestId'] as String);
          posts++;
          return posts == 1
              ? pending.future
              : Future.value(
                  json({
                    'error': {
                      'code': 'INTERNAL_ERROR',
                      'message': 'Erro interno',
                      'details': [],
                    },
                  }, 500),
                );
        });
        await tester.pumpWidget(
          app(QuizScreen(api: apiFor(mock), slug: 'demo')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('option-q1-A')));
        await tester.pump();

        await tester.tap(find.byKey(const Key('submit-button')));
        await tester.pump();
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        // Button is disabled while submitting, so a second tap sends nothing.
        await tester.tap(
          find.byKey(const Key('submit-button')),
          warnIfMissed: false,
        );
        await tester.pump();
        expect(posts, 1);

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

        await tester.tap(find.byKey(const Key('submit-button')));
        await tester.pumpAndSettle();
        expect(ids, hasLength(2));
        expect(ids[0], ids[1]);

        // Changing an answer is a new intent: new requestId.
        await tester.tap(find.byKey(const Key('option-q1-B')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('submit-button')));
        await tester.pumpAndSettle();
        expect(ids, hasLength(3));
        expect(ids[2], isNot(ids[0]));
      },
    );
  });

  group('recommendations content (test 19)', () {
    Future<void> show(WidgetTester tester, Map<String, Object?> body) async {
      tester.view.physicalSize = const Size(800, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        app(
          RecommendationsScreen(
            api: apiFor(MockClient((_) async => json(body))),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('ON_TRACK', (tester) async {
      await show(tester, recs('ON_TRACK'));
      expect(find.textContaining('Excelente'), findsOneWidget);
    });

    testWidgets('NEEDS_REVIEW lists suggested questions without answer key', (
      tester,
    ) async {
      await show(
        tester,
        recs('NEEDS_REVIEW', [
          topic(
            status: 'AVAILABLE',
            suggested: [
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
          ),
        ]),
      );
      expect(find.textContaining('Equações • prioridade alta'), findsOneWidget);
      expect(
        find.text('Última resposta certa em 1 de 4 questões (25%)'),
        findsOneWidget,
      );
      expect(find.textContaining('Quanto é x se x - 7 = 1?'), findsOneWidget);
      expect(find.textContaining('Correta'), findsNothing);
    });

    testWidgets(
      'LOW priority is shown as optional review, not as high priority',
      (tester) async {
        await show(
          tester,
          recs('NEEDS_REVIEW', [
            topic(
              priority: 'LOW',
              status: 'AVAILABLE',
              suggested: [
                {
                  'id': 'x1',
                  'statement': 'Quantos lados tem um hexágono?',
                  'options': [
                    {'key': 'A', 'text': '5'},
                    {'key': 'B', 'text': '6'},
                  ],
                  'difficulty': 'easy',
                },
              ],
            ),
          ]),
        );
        expect(
          find.textContaining('Equações • revisão opcional'),
          findsOneWidget,
        );
        expect(find.textContaining('prioridade alta'), findsNothing);
        expect(
          find.textContaining('você errou algumas questões'),
          findsOneWidget,
        );
        expect(
          find.textContaining('Quantos lados tem um hexágono?'),
          findsOneWidget,
        );
      },
    );

    testWidgets('HIGH and LOW together: no "only optional" hint', (
      tester,
    ) async {
      await show(
        tester,
        recs('NEEDS_REVIEW', [
          topic(status: 'NO_NEW_QUESTIONS', message: 'm'),
          topic(priority: 'LOW', status: 'NO_NEW_QUESTIONS', message: 'm'),
        ]),
      );
      expect(find.textContaining('prioridade alta'), findsOneWidget);
      expect(find.textContaining('revisão opcional'), findsOneWidget);
      expect(find.textContaining('você errou algumas questões'), findsNothing);
    });

    testWidgets(
      'NO_NEW_QUESTIONS shows the review message and no invented exercises',
      (tester) async {
        await show(
          tester,
          recs('NEEDS_REVIEW', [
            topic(status: 'NO_NEW_QUESTIONS', message: 'Revise o conteúdo.'),
          ]),
        );
        expect(find.text('Revise o conteúdo.'), findsOneWidget);
        expect(find.byType(Card), findsNothing);
      },
    );
  });

  group('result screen (test 19)', () {
    testWidgets('shows score, per-topic summary and per-question correction', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(800, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      const quiz = Quiz(
        id: 'quiz',
        slug: 'demo',
        title: 'S',
        questions: [
          Question(
            id: 'q1',
            statement: 'x + 2 = 5?',
            options: [
              AnswerOption(key: 'A', text: '2'),
              AnswerOption(key: 'B', text: '3'),
            ],
            difficulty: 'easy',
            topicName: 'Equações',
          ),
        ],
      );
      const result = AttemptResult(
        attemptId: 'a',
        correctCount: 0,
        totalCount: 1,
        scorePct: 33.33,
        topicResults: [
          TopicResult(
            topicName: 'Equações',
            correctCount: 0,
            totalCount: 1,
            accuracyPct: 0,
          ),
        ],
        answers: [
          AnswerResult(
            questionId: 'q1',
            selectedOption: 'A',
            correctOption: 'B',
            isCorrect: false,
            referenceExplanation: 'Subtraia 2.',
          ),
        ],
      );
      await tester.pumpWidget(
        app(
          ResultScreen(
            api: apiFor(MockClient((_) async => json({}))),
            quiz: quiz,
            result: result,
          ),
        ),
      );
      expect(find.text('33,33%'), findsOneWidget);
      expect(find.text('0 de 1 questão correta'), findsOneWidget);
      expect(find.text('0/1 (0%)'), findsOneWidget);
      expect(
        find.textContaining('Sua resposta: A • Correta: B'),
        findsOneWidget,
      );
      expect(find.textContaining('Subtraia 2.'), findsOneWidget);
      expect(find.byIcon(Icons.cancel), findsOneWidget);
    });
  });
}
