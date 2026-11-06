import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/services/api_client.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> recs() => {
  'studentId': 's',
  'status': 'NEEDS_REVIEW',
  'evaluatedAttempts': 1,
  'progress': <Object>[],
  'topics': [
    {
      'topicId': 'eq',
      'topicName': 'Equações',
      'priority': 'HIGH',
      'correctCount': 1,
      'answeredCount': 4,
      'accuracyPct': 25,
      'status': 'AVAILABLE',
      'suggestedQuestions': <Object>[],
    },
  ],
};

Map<String, Object?> reviewQuiz({int newCount = 2, int retryCount = 1}) => {
  'id': 'review-quiz',
  'slug': 'revisao-abc',
  'title': 'Revisão: Equações',
  'kind': 'review',
  'newCount': newCount,
  'retryCount': retryCount,
  'questions': [
    {
      'id': 'r1',
      'topic': {'id': 'eq', 'name': 'Equações'},
      'statement': 'Quanto é x se 3x = 12?',
      'options': [
        {'key': 'A', 'text': '3'},
        {'key': 'B', 'text': '4'},
      ],
      'difficulty': 'easy',
    },
  ],
};

Map<String, Object?> result() => {
  'attemptId': 'att',
  'quizId': 'review-quiz',
  'correctCount': 1,
  'totalCount': 1,
  'scorePct': 100,
  'topicResults': [
    {
      'topicId': 'eq',
      'topicName': 'Equações',
      'correctCount': 1,
      'totalCount': 1,
      'accuracyPct': 100,
    },
  ],
  'answers': [
    {
      'questionId': 'r1',
      'selectedOption': 'B',
      'correctOption': 'B',
      'isCorrect': true,
      'referenceExplanation': 'x = 4',
    },
  ],
};

void main() {
  void bigScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  Future<void> pumpRecs(WidgetTester tester, MockClient mock) async {
    bigScreen(tester);
    await tester.pumpWidget(
      MaterialApp(
        home: RecommendationsScreen(
          api: ApiClient(
            baseUrl: 'http://api.test',
            studentId: 's',
            client: mock,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('practice: create review quiz, answer it, come back and reload', (
    tester,
  ) async {
    var recsCalls = 0;
    late Map<String, dynamic> created;
    late Map<String, dynamic> posted;
    final mock = MockClient((req) async {
      if (req.url.path.endsWith('/review-quizzes')) {
        created = jsonDecode(req.body) as Map<String, dynamic>;
        return json(reviewQuiz());
      }
      if (req.url.path.endsWith('/attempts') && req.method == 'POST') {
        posted = jsonDecode(req.body) as Map<String, dynamic>;
        return json(result(), 201);
      }
      recsCalls++;
      return json(recs());
    });
    await pumpRecs(tester, mock);
    expect(recsCalls, 1);

    await tester.tap(find.byKey(const Key('practice-eq')));
    await tester.pumpAndSettle();
    expect(created, {'topicId': 'eq'});

    // Review quiz screen with its banner and title.
    expect(find.text('Revisão: Equações'), findsOneWidget);
    expect(find.byKey(const Key('review-banner')), findsOneWidget);
    expect(find.textContaining('2 inéditas e 1 para refazer'), findsOneWidget);
    expect(find.textContaining('não prova que você entendeu'), findsOneWidget);

    await tester.tap(find.byKey(const Key('option-r1-B')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit-button')));
    await tester.pumpAndSettle();
    expect(posted['quizId'], 'review-quiz');

    // Result of a review: no "see recommendations", a back button instead.
    expect(find.text('100%'), findsOneWidget);
    expect(find.byKey(const Key('recommendations-button')), findsNothing);
    expect(find.text('Voltar às recomendações'), findsOneWidget);

    await tester.tap(find.byKey(const Key('retake-button')));
    await tester.pumpAndSettle();

    // Back on the recommendations, which reloaded (silently).
    expect(find.text('Recomendações'), findsOneWidget);
    expect(find.byKey(const Key('practice-eq')), findsOneWidget);
    expect(recsCalls, 2);
  });

  testWidgets('shows only the new count when there is nothing to retry', (
    tester,
  ) async {
    final mock = MockClient((req) async {
      if (req.url.path.endsWith('/review-quizzes')) {
        return json(reviewQuiz(newCount: 3, retryCount: 0));
      }
      return json(recs());
    });
    await pumpRecs(tester, mock);
    await tester.tap(find.byKey(const Key('practice-eq')));
    await tester.pumpAndSettle();
    expect(find.textContaining('3 inéditas.'), findsOneWidget);
    expect(find.textContaining('para refazer'), findsNothing);
    expect(find.textContaining('não prova que você entendeu'), findsNothing);
  });

  testWidgets('the practice button shows progress and blocks double taps', (
    tester,
  ) async {
    final pending = Completer<http.Response>();
    var created = 0;
    final mock = MockClient((req) {
      if (req.url.path.endsWith('/review-quizzes')) {
        created++;
        return pending.future;
      }
      return Future.value(json(recs()));
    });
    await pumpRecs(tester, mock);

    await tester.tap(find.byKey(const Key('practice-eq')));
    await tester.pump();
    final button = find.byKey(const Key('practice-eq'));
    expect(
      find.descendant(
        of: button,
        matching: find.byType(CircularProgressIndicator),
      ),
      findsOneWidget,
    );
    await tester.tap(button, warnIfMissed: false);
    await tester.pump();
    expect(created, 1);

    pending.complete(json(reviewQuiz()));
    await tester.pumpAndSettle();
    expect(find.text('Revisão: Equações'), findsOneWidget);
  });

  testWidgets('API errors are shown and the button works again', (
    tester,
  ) async {
    var calls = 0;
    final mock = MockClient((req) async {
      if (req.url.path.endsWith('/review-quizzes')) {
        calls++;
        if (calls == 1) {
          return json({
            'error': {
              'code': 'TOPIC_NOT_IN_REVIEW',
              'message': 'Este assunto não precisa de revisão no momento',
              'details': <Object>[],
            },
          }, 400);
        }
        return json(reviewQuiz());
      }
      return json(recs());
    });
    await pumpRecs(tester, mock);

    await tester.tap(find.byKey(const Key('practice-eq')));
    await tester.pumpAndSettle();
    expect(
      find.text('Este assunto não precisa de revisão no momento'),
      findsOneWidget,
    );
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('practice-eq')))
          .onPressed,
      isNotNull,
    );

    await tester.tap(find.byKey(const Key('practice-eq')));
    await tester.pumpAndSettle();
    expect(find.text('Revisão: Equações'), findsOneWidget);
  });
}
