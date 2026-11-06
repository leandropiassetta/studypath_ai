import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/models/attempt_result.dart';
import 'package:studypath_app/models/quiz.dart';
import 'package:studypath_app/screens/auth_screen.dart';
import 'package:studypath_app/screens/quiz_screen.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/screens/result_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';
import 'package:studypath_app/utils/contrast.dart';
import 'package:studypath_app/utils/plural.dart';
import 'package:studypath_app/widgets/topic_tag.dart';

import 'test_support.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const quizJson = {
  'id': 'quiz',
  'slug': 'demo',
  'title': 'Simulado de Matemática',
  'kind': 'standard',
  'questions': [
    {
      'id': 'q1',
      'topic': {'id': 't', 'name': 'Equações'},
      'statement': 'Quanto é x se x + 2 = 5, considerando apenas números inteiros positivos?',
      'options': [
        {
          'key': 'A',
          'text':
              'Alternativa com um texto razoavelmente longo para quebrar linha',
        },
        {'key': 'B', 'text': '3'},
      ],
      'difficulty': 'easy',
    },
    {
      'id': 'q2',
      'topic': {'id': 't2', 'name': 'Geometria'},
      'statement': 'Soma dos ângulos internos de um triângulo?',
      'options': [
        {'key': 'A', 'text': '90'},
        {'key': 'B', 'text': '180'},
      ],
      'difficulty': 'hard',
    },
  ],
};

ApiClient apiWith(http.Client mock) =>
    ApiClient(baseUrl: 'http://api.test', studentId: 's', client: mock);
ApiClient quizApi() => apiWith(MockClient((_) async => json(quizJson)));

/// Wraps a screen in an app with a given text scale and brightness.
Widget app(
  Widget home, {
  double textScale = 1,
  Brightness brightness = Brightness.light,
}) => MaterialApp(
  theme: ThemeData(
    colorSchemeSeed: Colors.indigo,
    brightness: brightness,
    useMaterial3: true,
  ),
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context)
        .copyWith(textScaler: TextScaler.linear(textScale)),
    child: child!,
  ),
  home: home,
);

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(
    400,
    800,
  ); // a small phone, in logical pixels
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  test('plural picks the singular only for exactly one', () {
    expect(plural(0, 'tentativa', 'tentativas'), '0 tentativas');
    expect(plural(1, 'tentativa', 'tentativas'), '1 tentativa');
    expect(plural(2, 'tentativa', 'tentativas'), '2 tentativas');
  });

  group('contrast', () {
    test('the ratio is symmetric and spans 1 to 21', () {
      expect(contrastRatio(Colors.black, Colors.white), closeTo(21, 0.01));
      expect(contrastRatio(Colors.white, Colors.white), closeTo(1, 0.001));
      expect(
        contrastRatio(Colors.black, Colors.white),
        contrastRatio(Colors.white, Colors.black),
      );
    });

    test(
      'ensureContrast keeps good colors and fixes bad ones in both directions',
      () {
        expect(ensureContrast(Colors.black, Colors.white), Colors.black);
        final onLight = ensureContrast(const Color(0xFFEF6C00), Colors.white);
        expect(contrastRatio(onLight, Colors.white), greaterThanOrEqualTo(4.5));
        const darkSurface = Color(0xFF1C1B1F);
        final onDark = ensureContrast(const Color(0xFF3F51B5), darkSurface);
        expect(contrastRatio(onDark, darkSurface), greaterThanOrEqualTo(4.5));
      },
    );

    test('every topic tag is readable (4.5:1) on light and dark surfaces', () {
      const surfaces = [
        Colors.white,
        Color(0xFFFFFBFE),
        Color(0xFF1C1B1F),
        Color(0xFF141218),
      ];
      // Names chosen to hit every color of the palette.
      final names =
          List.generate(60, (i) => 'Assunto $i') +
          [
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
      final used = <Color>{};
      for (final surface in surfaces) {
        for (final name in names) {
          used.add(topicColor(name));
          final colors = topicTagColors(name, surface);
          expect(
            contrastRatio(colors.foreground, colors.background),
            greaterThanOrEqualTo(4.5),
            reason: '$name on $surface',
          );
        }
      }
      expect(used.length, 10, reason: 'the check covered the whole palette');
    });
  });

  group('accessibility labels', () {
    testWidgets('the quiz announces progress, topic and difficulty in words', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      phone(tester);
      await tester.pumpWidget(app(QuizScreen(api: quizApi(), slug: 'demo')));
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel('Progresso do simulado'), findsOneWidget);
      // Card semantics merge the labels of their children, so match a part of the label.
      expect(
        find.bySemanticsLabel(RegExp('Assunto: Equações')),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel(RegExp('Dificuldade: Fácil')),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel(RegExp('Dificuldade: Difícil')),
        findsWidgets,
      );

      await tester.tap(find.byKey(const Key('option-q1-B')));
      await tester.pumpAndSettle();
      final progress = tester.getSemantics(
        find.bySemanticsLabel('Progresso do simulado'),
      );
      expect(progress.value, '1 de 2 questões respondidas');
      handle.dispose();
    });

    testWidgets(
      'the result labels correct and incorrect answers for screen readers',
      (tester) async {
        final handle = tester.ensureSemantics();
        phone(tester);
        const quiz = Quiz(
          id: 'q',
          slug: 's',
          title: 'T',
          questions: [
            Question(
              id: 'a',
              statement: 'Pergunta A',
              options: [AnswerOption(key: 'A', text: '1')],
              difficulty: 'easy',
              topicName: 'Equações',
            ),
            Question(
              id: 'b',
              statement: 'Pergunta B',
              options: [AnswerOption(key: 'A', text: '1')],
              difficulty: 'easy',
              topicName: 'Equações',
            ),
          ],
        );
        const result = AttemptResult(
          attemptId: 'x',
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
              questionId: 'a',
              selectedOption: 'A',
              correctOption: 'A',
              isCorrect: true,
              referenceExplanation: 'ok',
            ),
            AnswerResult(
              questionId: 'b',
              selectedOption: 'B',
              correctOption: 'A',
              isCorrect: false,
              referenceExplanation: 'ok',
            ),
          ],
        );
        await tester.pumpWidget(
          app(ResultScreen(api: quizApi(), quiz: quiz, result: result)),
        );
        expect(
          find.bySemanticsLabel(RegExp('Resposta correta')),
          findsOneWidget,
        );
        expect(
          find.bySemanticsLabel(RegExp('Resposta incorreta')),
          findsOneWidget,
        );
        expect(find.text('1 de 2 questões corretas'), findsOneWidget);
        handle.dispose();
      },
    );

    testWidgets('a single question reads "questão correta" in the singular', (
      tester,
    ) async {
      phone(tester);
      const quiz = Quiz(
        id: 'q',
        slug: 's',
        title: 'T',
        questions: [
          Question(
            id: 'a',
            statement: 'P',
            options: [AnswerOption(key: 'A', text: '1')],
            difficulty: 'easy',
            topicName: 'Equações',
          ),
        ],
      );
      const result = AttemptResult(
        attemptId: 'x',
        correctCount: 1,
        totalCount: 1,
        scorePct: 100,
        topicResults: [
          TopicResult(
            topicName: 'Equações',
            correctCount: 1,
            totalCount: 1,
            accuracyPct: 100,
          ),
        ],
        answers: [
          AnswerResult(
            questionId: 'a',
            selectedOption: 'A',
            correctOption: 'A',
            isCorrect: true,
            referenceExplanation: 'ok',
          ),
        ],
      );
      await tester.pumpWidget(
        app(ResultScreen(api: quizApi(), quiz: quiz, result: result)),
      );
      expect(find.text('1 de 1 questão correta'), findsOneWidget);
    });
  });

  group('large text (200%) does not break the layout', () {
    testWidgets('login and sign-up forms', (tester) async {
      phone(tester);
      final controller = SessionController(quizApi());
      await tester.pumpWidget(
        app(AuthScreen(controller: controller), textScale: 2),
      );
      await tester.tap(find.text('Criar conta').first);
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const Key('auth-submit')),
      ); // shows every validation message
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('field-name')), findsOneWidget);
    });

    testWidgets('quiz with long statements and options', (tester) async {
      phone(tester);
      await tester.pumpWidget(
        app(QuizScreen(api: quizApi(), slug: 'demo'), textScale: 2),
      );
      await tester.pumpAndSettle();
      // At 200% the option can be below the fold: scroll to it like a user would.
      await tester.ensureVisible(find.byKey(const Key('option-q1-A')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('option-q1-A')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Enviar respostas (1/2)'), findsOneWidget);
    });

    testWidgets('recommendations with progress, tags and practice buttons', (
      tester,
    ) async {
      phone(tester);
      final api = apiWith(
        MockClient(
          (_) async => json({
            'studentId': 's',
            'status': 'NEEDS_REVIEW',
            'evaluatedAttempts': 2,
            'progress': [
              {
                'attemptId': 'a1',
                'submittedAt': '2026-01-01T00:00:00Z',
                'scorePct': 25,
                'topics': [
                  {
                    'topicId': 'e',
                    'topicName': 'Equações',
                    'correctCount': 1,
                    'totalCount': 4,
                    'accuracyPct': 25,
                  },
                ],
              },
              {
                'attemptId': 'a2',
                'submittedAt': '2026-01-02T00:00:00Z',
                'scorePct': 75,
                'topics': [
                  {
                    'topicId': 'e',
                    'topicName': 'Equações',
                    'correctCount': 3,
                    'totalCount': 4,
                    'accuracyPct': 75,
                  },
                ],
              },
            ],
            'topics': [
              {
                'topicId': 'e',
                'topicName': 'Equações',
                'priority': 'HIGH',
                'correctCount': 1,
                'answeredCount': 4,
                'accuracyPct': 25,
                'status': 'AVAILABLE',
                'suggestedQuestions': [
                  {
                    'id': 'x1',
                    'statement': 'Quanto é x se x - 7 = 1 e a resposta deve ser inteira?',
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
        ),
      );
      await tester.pumpWidget(
        app(RecommendationsScreen(api: api), textScale: 2),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.text('Considerando 2 tentativas.', findRichText: true),
        findsNothing,
      ); // part of a longer line
      expect(find.textContaining('Considerando 2 tentativas'), findsOneWidget);
    });
  });

  group('touch targets', () {
    testWidgets('answer options and the main buttons are at least 48 dp tall', (
      tester,
    ) async {
      phone(tester);
      await tester.pumpWidget(app(QuizScreen(api: quizApi(), slug: 'demo')));
      await tester.pumpAndSettle();
      for (final tile in tester.widgetList(
        find.byType(RadioListTile<String>),
      )) {
        final size = tester.getSize(find.byWidget(tile));
        expect(size.height, greaterThanOrEqualTo(48), reason: 'option row');
      }
      expect(
        tester.getSize(find.byKey(const Key('submit-button'))).height,
        greaterThanOrEqualTo(48),
      );
    });
  });

  group('dark mode', () {
    testWidgets('the app follows the system brightness', (tester) async {
      phone(tester);
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      final api = apiWith(
        withQuizList(MockClient((_) async => json(quizJson))),
      );
      await tester.pumpWidget(loggedInApp(api));
      await tester.pumpAndSettle();
      await openQuizFromPicker(tester);

      final context = tester.element(find.byType(Scaffold).first);
      expect(Theme.of(context).brightness, Brightness.dark);
      expect(find.text('Simulado de Matemática'), findsOneWidget);
      expect(tester.takeException(), isNull);
      // The tags stay readable against the dark surface actually in use.
      final surface = Theme.of(context).colorScheme.surface;
      final colors = topicTagColors('Equações', surface);
      expect(
        contrastRatio(colors.foreground, colors.background),
        greaterThanOrEqualTo(4.5),
      );
    });

    testWidgets('and switches back to light', (tester) async {
      phone(tester);
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      await tester.pumpWidget(loggedInApp(quizApi()));
      await tester.pumpAndSettle();
      expect(
        Theme.of(tester.element(find.byType(Scaffold).first)).brightness,
        Brightness.light,
      );
    });
  });

  group('leaving the quiz', () {
    Future<void> openQuiz(WidgetTester tester) async {
      phone(tester);
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  key: const Key('open'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => QuizScreen(api: quizApi(), slug: 'demo'),
                    ),
                  ),
                  child: const Text('abrir'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.byKey(const Key('open')));
      await tester.pumpAndSettle();
    }

    testWidgets('going back with no answers leaves immediately', (
      tester,
    ) async {
      await openQuiz(tester);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('Sair do simulado?'), findsNothing);
      expect(find.byKey(const Key('open')), findsOneWidget);
    });

    testWidgets('with answers it asks first and "continue" keeps the answers', (
      tester,
    ) async {
      await openQuiz(tester);
      await tester.tap(find.byKey(const Key('option-q1-B')));
      await tester.pump();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.text('Sair do simulado?'), findsOneWidget);
      expect(find.textContaining('Você marcou 1 resposta.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('keep-quiz')));
      await tester.pumpAndSettle();
      expect(find.text('Sair do simulado?'), findsNothing);
      expect(
        find.text('Enviar respostas (1/2)'),
        findsOneWidget,
      ); // still there
    });

    testWidgets(
      '"Sair" confirms and leaves; the message is plural for several answers',
      (tester) async {
        await openQuiz(tester);
        await tester.tap(find.byKey(const Key('option-q1-B')));
        await tester.tap(find.byKey(const Key('option-q2-A')));
        await tester.pump();
        await tester.tap(find.byType(BackButton));
        await tester.pumpAndSettle();
        expect(find.textContaining('Você marcou 2 respostas.'), findsOneWidget);

        await tester.tap(find.byKey(const Key('leave-quiz')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('open')), findsOneWidget);
      },
    );
  });
}
