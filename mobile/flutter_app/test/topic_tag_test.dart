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
import 'package:studypath_app/widgets/topic_tag.dart';

http.Response json(Object body) => http.Response(
  jsonEncode(body),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

ApiClient apiFor(MockClient mock) =>
    ApiClient(baseUrl: 'http://api.test', studentId: 's', client: mock);

Finder tagText(String key, String name) =>
    find.descendant(of: find.byKey(Key(key)), matching: find.text(name));

void main() {
  test('topicColor is stable per name and differs between the demo topics', () {
    expect(topicColor('Equações'), topicColor('Equações'));
    expect(topicColor('Equações'), isNot(topicColor('Geometria')));
  });

  test('Question.withTopicName keeps everything else', () {
    const q = Question(
      id: 'x',
      statement: 's',
      options: [AnswerOption(key: 'A', text: '1')],
      difficulty: 'easy',
    );
    final tagged = q.withTopicName('Equações');
    expect(tagged.topicName, 'Equações');
    expect(tagged.id, 'x');
    expect(tagged.statement, 's');
    expect(tagged.options.single.key, 'A');
    expect(tagged.difficulty, 'easy');
  });

  testWidgets('quiz questions show a topic tag', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final mock = MockClient(
      (_) async => json({
        'id': 'quiz',
        'slug': 'demo',
        'title': 'S',
        'questions': [
          for (final (id, topic) in [('q1', 'Equações'), ('q2', 'Geometria')])
            {
              'id': id,
              'topic': {'id': topic, 'name': topic},
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
    expect(tagText('topic-q1', 'Equações'), findsOneWidget);
    expect(tagText('topic-q2', 'Geometria'), findsOneWidget);
  });

  testWidgets(
    'suggested exercises get the tag of the topic they are listed under',
    (tester) async {
      tester.view.physicalSize = const Size(800, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final mock = MockClient(
        (_) async => json({
          'studentId': 's',
          'status': 'NEEDS_REVIEW',
          'evaluatedAttempts': 1,
          'progress': <Object>[],
          'topics': [
            {
              'topicId': 'g',
              'topicName': 'Geometria',
              'priority': 'HIGH',
              'correctCount': 1,
              'answeredCount': 4,
              'accuracyPct': 25,
              'status': 'AVAILABLE',
              'suggestedQuestions': [
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
            },
          ],
        }),
      );
      await tester.pumpWidget(
        MaterialApp(home: RecommendationsScreen(api: apiFor(mock))),
      );
      await tester.pumpAndSettle();
      expect(tagText('topic-x1', 'Geometria'), findsOneWidget);
    },
  );

  testWidgets('corrections in the result show the topic tag', (tester) async {
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
          options: [AnswerOption(key: 'A', text: '2')],
          difficulty: 'easy',
          topicName: 'Equações',
        ),
      ],
    );
    const result = AttemptResult(
      attemptId: 'a',
      correctCount: 1,
      totalCount: 1,
      scorePct: 100,
      topicResults: [],
      answers: [
        AnswerResult(
          questionId: 'q1',
          selectedOption: 'A',
          correctOption: 'A',
          isCorrect: true,
          referenceExplanation: 'ok',
        ),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: ResultScreen(
          api: apiFor(MockClient((_) async => json({}))),
          quiz: quiz,
          result: result,
        ),
      ),
    );
    expect(tagText('result-topic-q1', 'Equações'), findsOneWidget);
  });
}
