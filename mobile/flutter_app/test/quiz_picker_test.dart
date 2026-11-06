import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/quiz_summary.dart';
import 'package:studypath_app/screens/quiz_picker_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/widgets/topic_tag.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object> summary(
  String slug,
  String title,
  int n,
  List<String> topics,
) => {
  'id': 'id-$slug',
  'slug': slug,
  'title': title,
  'questionCount': n,
  'topics': [
    for (final t in topics) {'id': 't-$t', 'name': t},
  ],
};

final list = [
  summary('demo-ciencias', 'Simulado de Ciências', 4, ['Ciências']),
  summary('demo-geografia', 'Simulado de Geografia', 4, ['Geografia']),
  summary('demo-historia', 'Simulado de História', 1, ['História']),
  summary('demo-ingles', 'Simulado de Inglês', 4, ['Inglês']),
  summary('demo-matematica', 'Simulado de Matemática', 8, [
    'Equações',
    'Geometria',
  ]),
];

Map<String, Object> quizFor(String slug, String title) => {
  'id': 'id-$slug',
  'slug': slug,
  'title': title,
  'kind': 'standard',
  'questions': [
    {
      'id': 'q1',
      'topic': {'id': 't1', 'name': 'Geografia'},
      'statement': 'Qual é a capital do Brasil?',
      'options': [
        {'key': 'A', 'text': 'Rio de Janeiro'},
        {'key': 'B', 'text': 'Brasília'},
      ],
      'difficulty': 'easy',
    },
  ],
};

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

ApiClient apiWith(Future<http.Response> Function(http.Request) handler) =>
    ApiClient(
      baseUrl: 'http://api.test',
      studentId: 's',
      client: MockClient(handler),
    );

Future<void> pumpPicker(
  WidgetTester tester,
  ApiClient api, {
  Future<void> Function()? onLogout,
}) async {
  phone(tester);
  await tester.pumpWidget(
    MaterialApp(
      home: QuizPickerScreen(
        api: api,
        studentName: 'Maria',
        onLogout: onLogout,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('QuizSummary parses the list item', () {
    final s = QuizSummary.fromJson(list.last);
    expect(s.slug, 'demo-matematica');
    expect(s.questionCount, 8);
    expect(s.topics, ['Equações', 'Geometria']);
  });

  test('each subject gets its own tag color (no two subjects look alike)', () {
    final names = [
      'Equações',
      'Geometria',
      'Geografia do Brasil',
      'Geografia Mundial',
      'História do Brasil',
      'História Geral',
      'Vocabulário',
      'Gramática',
      'Biologia',
      'Física e Química',
    ];
    final colors = names.map(topicColor).toSet();
    expect(colors.length, names.length);
  });

  testWidgets('lists one card per subject with its size and topic tags', (
    tester,
  ) async {
    await pumpPicker(tester, apiWith((_) async => json(list)));
    expect(find.text('Escolha um assunto'), findsOneWidget);
    expect(find.textContaining('Olá, Maria'), findsOneWidget);
    for (final slug in [
      'demo-ciencias',
      'demo-geografia',
      'demo-historia',
      'demo-ingles',
      'demo-matematica',
    ]) {
      expect(find.byKey(Key('quiz-card-$slug')), findsOneWidget);
    }
    expect(find.text('8 questões'), findsOneWidget);
    expect(find.text('1 questão'), findsOneWidget); // singular
    expect(find.text('Equações'), findsOneWidget);
    expect(find.text('Geometria'), findsOneWidget);
    expect(find.text('História'), findsOneWidget);
  });

  testWidgets('tapping a subject opens that simulado', (tester) async {
    final asked = <String>[];
    await pumpPicker(
      tester,
      apiWith((req) async {
        asked.add(req.url.path);
        if (req.url.path.endsWith('/quizzes')) return json(list);
        return json(quizFor('demo-geografia', 'Simulado de Geografia'));
      }),
    );
    await tester.tap(find.byKey(const Key('quiz-card-demo-geografia')));
    await tester.pumpAndSettle();
    expect(asked.last, '/api/v1/quizzes/demo-geografia');
    expect(find.text('Simulado de Geografia'), findsOneWidget);
    expect(find.textContaining('capital do Brasil'), findsOneWidget);
    // The quiz opened from the picker has no logout of its own: going back returns to the picker.
    expect(find.byKey(const Key('logout-button')), findsNothing);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Escolha um assunto'), findsOneWidget);
  });

  testWidgets('a failed load shows the error and retry loads the list', (
    tester,
  ) async {
    var calls = 0;
    await pumpPicker(
      tester,
      apiWith((_) async {
        calls++;
        if (calls == 1) {
          return json({
            'error': {'code': 'X', 'message': 'Erro interno', 'details': []},
          }, 500);
        }
        return json(list);
      }),
    );
    expect(find.text('Erro interno'), findsOneWidget);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('quiz-card-demo-matematica')), findsOneWidget);
  });

  testWidgets(
    'a response that is not a list is an error with retry, never a crash',
    (tester) async {
      await pumpPicker(
        tester,
        apiWith((_) async => json({'unexpected': true})),
      );
      expect(find.text('Resposta inesperada da API.'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('an empty list says so', (tester) async {
    await pumpPicker(tester, apiWith((_) async => json(<Object>[])));
    expect(find.text('Nenhum simulado disponível.'), findsOneWidget);
  });

  testWidgets('the app bar has recommendations and logout', (tester) async {
    var loggedOut = false;
    await pumpPicker(
      tester,
      apiWith((req) async {
        if (req.url.path.endsWith('/recommendations')) {
          return json({
            'studentId': 's',
            'status': 'ON_TRACK',
            'evaluatedAttempts': 0,
            'topics': <Object>[],
            'progress': <Object>[],
          });
        }
        return json(list);
      }),
      onLogout: () async => loggedOut = true,
    );
    await tester.tap(find.byKey(const Key('recommendations-action')));
    await tester.pumpAndSettle();
    expect(find.text('Recomendações'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('logout-button')));
    expect(loggedOut, isTrue);
  });
}
