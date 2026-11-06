import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/recommendations.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/widgets/progress_section.dart';

ProgressPoint point(double score, double eq, double geo) => ProgressPoint(
  scorePct: score,
  topics: [
    ProgressTopic(topicName: 'Equações', accuracyPct: eq),
    ProgressTopic(topicName: 'Geometria', accuracyPct: geo),
  ],
);

Map<String, Object?> pointJson(num score, num eq, num geo) => {
  'attemptId': 'a$score',
  'submittedAt': '2026-01-01T00:00:00.000Z',
  'scorePct': score,
  'topics': [
    {
      'topicId': 'e',
      'topicName': 'Equações',
      'correctCount': 1,
      'totalCount': 4,
      'accuracyPct': eq,
    },
    {
      'topicId': 'g',
      'topicName': 'Geometria',
      'correctCount': 1,
      'totalCount': 4,
      'accuracyPct': geo,
    },
  ],
};

Future<void> showScreen(WidgetTester tester, Map<String, Object?> body) async {
  tester.view.physicalSize = const Size(800, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final mock = MockClient(
    (_) async => http.Response(
      jsonEncode(body),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    ),
  );
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

void main() {
  group('progressDelta / formatDelta', () {
    test('uses the last two values', () {
      expect(progressDelta([10, 25, 75]), 50);
      expect(progressDelta([75, 50]), -25);
      expect(progressDelta([50]), isNull);
      expect(progressDelta([]), isNull);
    });

    test('formats direction and no-change', () {
      expect(formatDelta(50), '▲ +50 pts');
      expect(formatDelta(-12.5), '▼ −12,5 pts');
      expect(formatDelta(0), '= sem mudança');
    });
  });

  group('ProgressSection', () {
    Future<void> pump(WidgetTester tester, List<ProgressPoint> p) =>
        tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(child: ProgressSection(progress: p)),
            ),
          ),
        );

    testWidgets(
      'shows the trajectory oldest to newest with the latest change',
      (tester) async {
        await pump(tester, [
          point(0, 0, 0),
          point(50, 25, 75),
          point(100, 100, 100),
        ]);
        expect(
          find.text('Sua evolução nos simulados completos'),
          findsOneWidget,
        );
        expect(find.text('0% → 50% → 100%'), findsOneWidget); // overall
        expect(find.text('0% → 25% → 100%'), findsOneWidget); // Equações
        expect(find.text('0% → 75% → 100%'), findsOneWidget); // Geometria
        expect(find.text('▲ +50 pts'), findsOneWidget); // overall: 50 -> 100
        expect(find.text('▲ +75 pts'), findsNWidgets(1)); // Equações: 25 -> 100
        expect(find.textContaining('não prova aprendizado'), findsOneWidget);
      },
    );

    testWidgets('shows a drop when the latest attempt is worse', (
      tester,
    ) async {
      await pump(tester, [point(100, 100, 100), point(50, 25, 75)]);
      expect(find.byKey(const Key('delta-Nota do simulado')), findsOneWidget);
      expect(find.text('▼ −50 pts'), findsOneWidget);
      expect(find.text('▼ −75 pts'), findsOneWidget);
    });

    testWidgets('with a single attempt there is no delta', (tester) async {
      await pump(tester, [point(50, 25, 75)]);
      expect(find.text('50%'), findsOneWidget);
      expect(find.textContaining('pts'), findsNothing);
    });

    testWidgets('renders nothing without attempts', (tester) async {
      await pump(tester, const []);
      expect(find.byKey(const Key('progress-section')), findsNothing);
    });
  });

  group('recommendations screen with progress', () {
    testWidgets(
      'ON_TRACK still shows the trajectory (improvement is visible)',
      (tester) async {
        await showScreen(tester, {
          'studentId': 's',
          'status': 'ON_TRACK',
          'evaluatedAttempts': 2,
          'topics': <Object>[],
          'progress': [pointJson(0, 0, 0), pointJson(100, 100, 100)],
        });
        expect(find.textContaining('Excelente'), findsOneWidget);
        expect(find.text('0% → 100%'), findsWidgets);
        expect(find.text('▲ +100 pts'), findsWidgets);
      },
    );

    testWidgets('NEEDS_REVIEW explains that priority uses the latest answers', (
      tester,
    ) async {
      await showScreen(tester, {
        'studentId': 's',
        'status': 'NEEDS_REVIEW',
        'evaluatedAttempts': 1,
        'progress': [pointJson(25, 25, 25)],
        'topics': [
          {
            'topicId': 'e',
            'topicName': 'Equações',
            'priority': 'HIGH',
            'correctCount': 1,
            'answeredCount': 4,
            'accuracyPct': 25,
            'status': 'NO_NEW_QUESTIONS',
            'message': 'm',
            'suggestedQuestions': <Object>[],
          },
        ],
      });
      expect(
        find.textContaining('última resposta de cada questão'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('progress-section')), findsOneWidget);
      expect(
        find.text('Última resposta certa em 1 de 4 questões (25%)'),
        findsOneWidget,
      );
    });

    testWidgets(
      'a response without progress still renders (backward compatible)',
      (tester) async {
        await showScreen(tester, {
          'studentId': 's',
          'status': 'ON_TRACK',
          'evaluatedAttempts': 1,
          'topics': <Object>[],
        });
        expect(find.textContaining('Excelente'), findsOneWidget);
        expect(find.byKey(const Key('progress-section')), findsNothing);
      },
    );
  });
}
