import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/recommendations.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/widgets/progress_section.dart';

Map<String, Object?> topic(
  String id,
  String name,
  String subject,
  String priority,
) => {
  'topicId': id,
  'topicName': name,
  'subject': subject,
  'priority': priority,
  'correctCount': 1,
  'answeredCount': 4,
  'accuracyPct': 25,
  'status': 'NO_NEW_QUESTIONS',
  'message': 'Sem novas.',
  'suggestedQuestions': <Object>[],
};

Map<String, Object?> body({
  String status = 'NEEDS_REVIEW',
  String? subject,
  String? progressSubject,
  List<Map<String, Object?>> topics = const [],
  int attempts = 1,
}) => {
  'studentId': 's',
  'status': status,
  'evaluatedAttempts': attempts,
  'subject': subject,
  'progressSubject': progressSubject,
  'progress': [
    {
      'attemptId': 'a1',
      'submittedAt': '2026-01-01T00:00:00.000Z',
      'scorePct': 25,
      'topics': [
        {
          'topicId': 'gb',
          'topicName': 'Geografia do Brasil',
          'correctCount': 1,
          'totalCount': 4,
          'accuracyPct': 25,
        },
      ],
    },
  ],
  'topics': topics,
};

Future<List<Uri>> show(
  WidgetTester tester,
  Map<String, Object?> response, {
  String? quizSlug,
}) async {
  tester.view.physicalSize = const Size(800, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final urls = <Uri>[];
  final mock = MockClient((req) async {
    urls.add(req.url);
    return http.Response(
      jsonEncode(response),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });
  await tester.pumpWidget(
    MaterialApp(
      home: RecommendationsScreen(
        quizSlug: quizSlug,
        api: ApiClient(
          baseUrl: 'http://api.test',
          studentId: 's',
          client: mock,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return urls;
}

void main() {
  test('Recommendations parses the subject fields, and older responses still parse', () {
    final r = Recommendations.fromJson(
      body(
        subject: 'Geografia',
        progressSubject: 'Geografia',
        topics: [topic('gb', 'Geografia do Brasil', 'Geografia', 'HIGH')],
      ),
    );
    expect(r.subject, 'Geografia');
    expect(r.progressSubject, 'Geografia');
    expect(r.topics.single.subject, 'Geografia');

    final old = Recommendations.fromJson({
      'status': 'ON_TRACK',
      'evaluatedAttempts': 1,
      'topics': <Object>[],
    });
    expect(old.subject, isNull);
    expect(old.progressSubject, isNull);
  });

  test('the request only carries ?quiz= when a subject is asked for', () async {
    final urls = <Uri>[];
    final api = ApiClient(
      baseUrl: 'http://api.test',
      studentId: 's',
      client: MockClient((req) async {
        urls.add(req.url);
        return http.Response(
          jsonEncode(body(status: 'NO_HISTORY', attempts: 0)),
          200,
        );
      }),
    );
    await api.fetchRecommendations();
    await api.fetchRecommendations(quizSlug: 'demo-geografia');
    expect(
      urls[0].toString(),
      'http://api.test/api/v1/students/s/recommendations',
    );
    expect(
      urls[1].toString(),
      'http://api.test/api/v1/students/s/recommendations?quiz=demo-geografia',
    );
  });

  testWidgets(
    'after a simulado: only that subject, named in the title and the evolution',
    (tester) async {
      final urls = await show(
        tester,
        body(
          subject: 'Geografia',
          progressSubject: 'Geografia',
          topics: [
            topic('gb', 'Geografia do Brasil', 'Geografia', 'HIGH'),
            topic('gm', 'Geografia Mundial', 'Geografia', 'LOW'),
          ],
        ),
        quizSlug: 'demo-geografia',
      );
      expect(urls.single.queryParameters['quiz'], 'demo-geografia');
      expect(find.text('Recomendações · Geografia'), findsOneWidget);
      expect(
        find.textContaining('Considerando 1 tentativa de Geografia'),
        findsOneWidget,
      );
      expect(find.text('Sua evolução em Geografia'), findsOneWidget);
      expect(find.text('Nota do simulado:'), findsOneWidget);
      expect(find.text('Nota geral:'), findsNothing);
      // One subject: no subject headings, just its topics.
      expect(find.byKey(const Key('subject-Geografia')), findsNothing);
      expect(
        find.textContaining('Geografia do Brasil • prioridade alta'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Geografia Mundial • revisão opcional'),
        findsOneWidget,
      );
    },
  );

  testWidgets('every subject at once: grouped under one heading per subject', (
    tester,
  ) async {
    await show(
      tester,
      body(
        progressSubject: 'Matemática',
        topics: [
          topic('eq', 'Equações', 'Matemática', 'HIGH'),
          topic('gb', 'Geografia do Brasil', 'Geografia', 'HIGH'),
          topic('ge', 'Geometria', 'Matemática', 'LOW'),
        ],
      ),
    );
    expect(find.text('Recomendações'), findsOneWidget);
    expect(find.byKey(const Key('subject-Geografia')), findsOneWidget);
    expect(find.byKey(const Key('subject-Matemática')), findsOneWidget);
    expect(find.text('Sua evolução em Matemática'), findsOneWidget);

    double y(Finder f) => tester.getTopLeft(f).dy;
    final geo = y(find.byKey(const Key('subject-Geografia')));
    final math = y(find.byKey(const Key('subject-Matemática')));
    expect(geo, lessThan(math)); // alphabetical
    // Both Matemática topics sit under the Matemática heading, after Geografia's.
    expect(y(find.textContaining('Equações •')), greaterThan(math));
    expect(y(find.textContaining('Geometria •')), greaterThan(math));
    expect(y(find.textContaining('Geografia do Brasil •')), lessThan(math));
  });

  testWidgets('a subject without attempts says which simulado to take', (
    tester,
  ) async {
    await show(
      tester,
      body(status: 'NO_HISTORY', subject: 'História', attempts: 0),
      quizSlug: 'demo-historia',
    );
    expect(find.text('Recomendações · História'), findsOneWidget);
    expect(
      find.text('Faça o simulado de História para receber recomendações.'),
      findsOneWidget,
    );
  });

  testWidgets('a subject that is all right celebrates that subject', (
    tester,
  ) async {
    await show(
      tester,
      body(status: 'ON_TRACK', subject: 'Inglês', progressSubject: 'Inglês'),
      quizSlug: 'demo-ingles',
    );
    expect(find.textContaining('Tudo certo em Inglês'), findsOneWidget);
    expect(find.text('Sua evolução em Inglês'), findsOneWidget);
  });

  testWidgets(
    'ProgressSection falls back to the generic title without a subject',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ProgressSection(
              progress: [ProgressPoint(scorePct: 50, topics: [])],
            ),
          ),
        ),
      );
      expect(find.text('Sua evolução nos simulados completos'), findsOneWidget);
    },
  );
}
