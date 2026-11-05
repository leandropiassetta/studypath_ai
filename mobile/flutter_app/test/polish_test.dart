import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/screens/quiz_screen.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/screens/result_screen.dart' show formatPct;
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/widgets/centered_content.dart';

http.Response json(Object body) => http.Response(
  jsonEncode(body),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

ApiClient apiFor(MockClient mock) =>
    ApiClient(baseUrl: 'http://api.test', studentId: 's', client: mock);

void main() {
  test('formatPct drops noise and uses a decimal comma', () {
    expect(formatPct(50), '50%');
    expect(formatPct(100), '100%');
    expect(formatPct(0), '0%');
    expect(formatPct(87.5), '87,5%');
    expect(formatPct(33.33), '33,33%');
    expect(formatPct(66.67), '66,67%');
    expect(formatPct(12.5), '12,5%');
    expect(formatPct(10), '10%');
  });

  testWidgets('content width is capped on wide windows', (tester) async {
    tester.view.physicalSize = const Size(2000, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final mock = MockClient(
      (_) async => json({
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
    await tester.pumpWidget(
      MaterialApp(
        home: QuizScreen(api: apiFor(mock), slug: 'demo'),
      ),
    );
    await tester.pumpAndSettle();

    final size = tester.getSize(find.byType(Card).first);
    expect(size.width, lessThanOrEqualTo(CenteredContent.maxWidth));
    final center = tester.getCenter(find.byType(Card).first);
    expect(center.dx, closeTo(1000, 1)); // horizontally centered
  });

  testWidgets('recommended exercises are read-only: no radio buttons', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final mock = MockClient(
      (_) async => json({
        'studentId': 's',
        'status': 'NEEDS_REVIEW',
        'evaluatedAttempts': 1,
        'topics': [
          {
            'topicId': 't',
            'topicName': 'Equações',
            'priority': 'HIGH',
            'correctCount': 1,
            'answeredCount': 4,
            'accuracyPct': 25,
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
      }),
    );
    await tester.pumpWidget(
      MaterialApp(home: RecommendationsScreen(api: apiFor(mock))),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Quanto é x se x - 7 = 1?'), findsOneWidget);
    expect(find.text('B) 8'), findsOneWidget); // options still listed
    expect(find.byType(Radio<String>), findsNothing);
    expect(find.byType(RadioListTile<String>), findsNothing);
  });
}
