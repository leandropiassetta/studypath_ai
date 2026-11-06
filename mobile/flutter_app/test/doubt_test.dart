import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/attempt_result.dart';
import 'package:studypath_app/models/doubt.dart';
import 'package:studypath_app/models/quiz.dart';
import 'package:studypath_app/screens/doubt_screen.dart';
import 'package:studypath_app/screens/result_screen.dart';
import 'package:studypath_app/services/api_client.dart';

import 'test_support.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> doubtJson({
  int used = 0,
  List<Map<String, Object?>> hints = const [],
  String? message,
}) => {
  'id': 'd1',
  'attemptId': 'att',
  'questionId': 'q1',
  'status': 'AI_HINTS',
  'message': message,
  'hintsUsed': used,
  'maxHints': 3,
  'hints': hints,
};

Map<String, Object?> hintJson(
  int level, {
  String source = 'llm',
  String? notice,
}) => {
  'level': level,
  'text': 'Texto da dica $level',
  'source': source,
  'hintsUsed': level,
  'hasMore': level < 3,
  'notice': ?notice,
};

const question = Question(
  id: 'q1',
  statement: 'Resolva 2(x + 3) = 5x - 3.',
  options: [
    AnswerOption(key: 'A', text: '1'),
    AnswerOption(key: 'C', text: '3'),
  ],
  difficulty: 'hard',
  topicName: 'Equações',
);

ApiClient apiWith(MockClient mock) {
  final api = ApiClient(baseUrl: 'http://api.test', client: mock);
  api.useSession(fakeSession());
  return api;
}

Future<void> pumpDoubt(WidgetTester tester, ApiClient api) async {
  tester.view.physicalSize = const Size(600, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: DoubtScreen(
        api: api,
        attemptId: 'att',
        question: question,
        selectedOption: 'A',
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('models and client', () {
    test('Doubt and HintResult parse, including the optional notice', () {
      final d = Doubt.fromJson(doubtJson(used: 1, hints: [hintJson(1)]));
      expect(d.hasMoreHints, isTrue);
      expect(d.hints.single.isAi, isTrue);
      expect(Doubt.fromJson(doubtJson(used: 3)).hasMoreHints, isFalse);

      final r = HintResult.fromJson(
        hintJson(2, source: 'reference', notice: 'limite'),
      );
      expect(r.hint.isAi, isFalse);
      expect(r.notice, 'limite');
      expect(r.hasMore, isTrue);
      expect(HintResult.fromJson(hintJson(3)).hasMore, isFalse);
      expect(HintResult.fromJson(hintJson(3)).notice, isNull);
    });

    test('openDoubt sends the ids and only a non-blank, trimmed note; nextHint posts to the doubt', () async {
      final seen = <http.Request>[];
      final api = apiWith(
        MockClient((req) async {
          seen.add(req);
          return req.url.path.endsWith('/hints')
              ? json(hintJson(1))
              : json(doubtJson(), 201);
        }),
      );
      await api.openDoubt(attemptId: 'att', questionId: 'q1');
      await api.openDoubt(attemptId: 'att', questionId: 'q1', message: '   ');
      await api.openDoubt(
        attemptId: 'att',
        questionId: 'q1',
        message: '  não entendi  ',
      );
      await api.nextHint('d1');

      expect(jsonDecode(seen[0].body), {
        'attemptId': 'att',
        'questionId': 'q1',
      });
      expect(jsonDecode(seen[1].body).containsKey('message'), isFalse);
      expect(jsonDecode(seen[2].body)['message'], 'não entendi');
      expect(seen[3].url.path, '/api/v1/doubts/d1/hints');
      expect(
        seen.every((r) => r.headers['authorization'] == 'Bearer ${'t' * 43}'),
        isTrue,
      );
    });
  });

  group('DoubtScreen', () {
    testWidgets(
      'opens the doubt on entry and shows the question, topic and the first button',
      (tester) async {
        final seen = <http.Request>[];
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              seen.add(req);
              return json(doubtJson(), 201);
            }),
          ),
        );
        expect(seen.single.url.path, '/api/v1/doubts');
        expect(find.text('Resolva 2(x + 3) = 5x - 3.'), findsOneWidget);
        expect(find.text('Equações'), findsOneWidget);
        expect(find.text('Você marcou a alternativa A.'), findsOneWidget);
        expect(find.byKey(const Key('doubt-message')), findsOneWidget);
        expect(find.text('Preciso de uma dica'), findsOneWidget);
        expect(find.byKey(const Key('hint-1')), findsNothing);
      },
    );

    testWidgets(
      'gives hints one at a time, in order, and ends with the full solution',
      (tester) async {
        var level = 0;
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              if (req.url.path.endsWith('/hints')) {
                level++;
                return json(hintJson(level));
              }
              return json(doubtJson(), 201);
            }),
          ),
        );

        await tester.tap(find.byKey(const Key('ask-hint')));
        await tester.pumpAndSettle();
        expect(find.text('Dica 1 de 3'), findsOneWidget);
        expect(find.text('Texto da dica 1'), findsOneWidget);
        expect(find.text('IA'), findsOneWidget);
        expect(
          find.byKey(const Key('doubt-message')),
          findsNothing,
        ); // the note is only for before the first hint
        expect(find.text('Preciso de mais uma dica'), findsOneWidget);

        await tester.tap(find.byKey(const Key('ask-hint')));
        await tester.pumpAndSettle();
        expect(find.text('Dica 2 de 3'), findsOneWidget);
        expect(
          find.text('Ver a solução completa'),
          findsOneWidget,
        ); // the next one is the solution

        await tester.tap(find.byKey(const Key('ask-hint')));
        await tester.pumpAndSettle();
        expect(find.text('Solução'), findsOneWidget);
        expect(find.text('Texto da dica 3'), findsOneWidget);
        expect(find.byKey(const Key('ask-hint')), findsNothing);
        expect(
          find.text('Você viu todas as 3 dicas desta dúvida.'),
          findsOneWidget,
        );
      },
    );

    testWidgets('sends the optional note before the first hint, trimmed', (
      tester,
    ) async {
      final bodies = <Map<String, dynamic>>[];
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) async {
            if (req.url.path.endsWith('/hints')) return json(hintJson(1));
            bodies.add(jsonDecode(req.body) as Map<String, dynamic>);
            return json(doubtJson(message: 'não entendi o 3'), 200);
          }),
        ),
      );
      await tester.enterText(
        find.byKey(const Key('doubt-message')),
        '  não entendi o 3  ',
      );
      await tester.tap(find.byKey(const Key('ask-hint')));
      await tester.pumpAndSettle();
      expect(
        bodies.first.containsKey('message'),
        isFalse,
      ); // opened on entry, without a note
      expect(
        bodies.last['message'],
        'não entendi o 3',
      ); // re-sent with the note before the hint
    });

    testWidgets(
      'a standard (non-AI) hint is labelled, and a usage-limit notice is shown',
      (tester) async {
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              if (req.url.path.endsWith('/hints')) {
                return json(
                  hintJson(
                    1,
                    source: 'reference',
                    notice: 'Muitas dicas em pouco tempo.',
                  ),
                );
              }
              return json(doubtJson(), 201);
            }),
          ),
        );
        await tester.tap(find.byKey(const Key('ask-hint')));
        await tester.pumpAndSettle();
        expect(find.text('Dica padrão'), findsOneWidget);
        expect(find.text('IA'), findsNothing);
        expect(find.byKey(const Key('hint-notice')), findsOneWidget);
        expect(find.text('Muitas dicas em pouco tempo.'), findsOneWidget);
      },
    );

    testWidgets(
      'the final hint from the reference is labelled as the solution',
      (tester) async {
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              if (req.url.path.endsWith('/hints')) {
                return json(hintJson(3, source: 'reference'));
              }
              return json(doubtJson(), 201);
            }),
          ),
        );
        await tester.tap(find.byKey(const Key('ask-hint')));
        await tester.pumpAndSettle();
        expect(find.text('Solução'), findsOneWidget);
        expect(find.text('Dica padrão'), findsNothing);
        expect(find.text('IA'), findsNothing);
      },
    );

    testWidgets('shows progress while asking and ignores a second tap', (
      tester,
    ) async {
      final pending = Completer<http.Response>();
      var hintCalls = 0;
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) {
            if (req.url.path.endsWith('/hints')) {
              hintCalls++;
              return pending.future;
            }
            return Future.value(json(doubtJson(), 201));
          }),
        ),
      );
      await tester.tap(find.byKey(const Key('ask-hint')));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.byKey(const Key('ask-hint')), warnIfMissed: false);
      await tester.pump();
      expect(hintCalls, 1);
      pending.complete(json(hintJson(1)));
      await tester.pumpAndSettle();
      expect(find.text('Dica 1 de 3'), findsOneWidget);
    });

    testWidgets('an error keeps what was shown and offers to try again', (
      tester,
    ) async {
      var calls = 0;
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) async {
            if (req.url.path.endsWith('/hints')) {
              calls++;
              if (calls == 1) {
                return json({
                  'error': {
                    'code': 'INTERNAL_ERROR',
                    'message': 'Erro interno',
                    'details': <Object>[],
                  },
                }, 500);
              }
              return json(hintJson(1));
            }
            return json(doubtJson(), 201);
          }),
        ),
      );
      await tester.tap(find.byKey(const Key('ask-hint')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('doubt-error')), findsOneWidget);
      expect(find.text('Erro interno'), findsOneWidget);
      expect(find.text('Tentar de novo'), findsOneWidget);

      await tester.tap(find.byKey(const Key('ask-hint')));
      await tester.pumpAndSettle();
      expect(find.text('Dica 1 de 3'), findsOneWidget);
      expect(find.byKey(const Key('doubt-error')), findsNothing);
    });

    testWidgets(
      'if the doubt cannot be opened it shows the error with a retry',
      (tester) async {
        var calls = 0;
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              calls++;
              if (calls == 1) {
                return json({
                  'error': {
                    'code': 'ATTEMPT_NOT_FOUND',
                    'message': 'Tentativa não encontrada',
                    'details': <Object>[],
                  },
                }, 404);
              }
              return json(doubtJson(), 201);
            }),
          ),
        );
        expect(find.text('Tentativa não encontrada'), findsOneWidget);
        await tester.tap(find.text('Tentar novamente'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('ask-hint')), findsOneWidget);
      },
    );

    testWidgets(
      'reopening shows the hints already given and continues from the next level',
      (tester) async {
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              return json(
                doubtJson(used: 2, hints: [hintJson(1), hintJson(2)]),
                200,
              );
            }),
          ),
        );
        expect(find.text('Dica 1 de 3'), findsOneWidget);
        expect(find.text('Dica 2 de 3'), findsOneWidget);
        expect(find.text('Ver a solução completa'), findsOneWidget);
        expect(find.byKey(const Key('doubt-message')), findsNothing);
      },
    );

    testWidgets('hints are announced to screen readers with their level', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) async {
            return json(
              doubtJson(
                used: 3,
                hints: [hintJson(1), hintJson(2), hintJson(3)],
              ),
              200,
            );
          }),
        ),
      );
      expect(find.bySemanticsLabel(RegExp('Dica 1 de 3')), findsWidgets);
      expect(find.bySemanticsLabel(RegExp('Solução completa')), findsWidgets);
      handle.dispose();
    });
  });

  testWidgets(
    'the result offers "Tirar dúvida" only on wrong answers and opens the doubt screen',
    (tester) async {
      tester.view.physicalSize = const Size(600, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final seen = <String>[];
      final api = apiWith(
        MockClient((req) async {
          seen.add(req.url.path);
          return json(doubtJson(), 201);
        }),
      );
      const quiz = Quiz(
        id: 'quiz',
        slug: 's',
        title: 'T',
        questions: [
          question,
          Question(
            id: 'q2',
            statement: 'Segunda',
            options: [AnswerOption(key: 'A', text: '1')],
            difficulty: 'easy',
            topicName: 'Equações',
          ),
        ],
      );
      const result = AttemptResult(
        attemptId: 'att',
        correctCount: 1,
        totalCount: 2,
        scorePct: 50,
        topicResults: [
          TopicResult(
            topicName: 'Equações',
            correctCount: 1,
            totalCount: 2,
            accuracyPct: 50,
          ),
        ],
        answers: [
          AnswerResult(
            questionId: 'q1',
            selectedOption: 'A',
            correctOption: 'C',
            isCorrect: false,
            referenceExplanation: 'ok',
          ),
          AnswerResult(
            questionId: 'q2',
            selectedOption: 'A',
            correctOption: 'A',
            isCorrect: true,
            referenceExplanation: 'ok',
          ),
        ],
      );
      await tester.pumpWidget(
        MaterialApp(
          home: ResultScreen(api: api, quiz: quiz, result: result),
        ),
      );

      expect(find.byKey(const Key('doubt-q1')), findsOneWidget);
      expect(find.byKey(const Key('doubt-q2')), findsNothing);

      await tester.tap(find.byKey(const Key('doubt-q1')));
      await tester.pumpAndSettle();
      expect(find.text('Tirar dúvida'), findsWidgets); // the screen title
      expect(find.byKey(const Key('ask-hint')), findsOneWidget);
      expect(seen, contains('/api/v1/doubts'));
    },
  );
}
