import 'package:flutter_test/flutter_test.dart';
import 'package:studypath_app/models/attempt_result.dart';
import 'package:studypath_app/models/quiz.dart';
import 'package:studypath_app/models/recommendations.dart';
import 'package:studypath_app/services/request_id.dart';

void main() {
  reviewQuizModelTests();
  test('parses a quiz', () {
    final quiz = Quiz.fromJson({
      'id': 'q',
      'slug': 'demo',
      'title': 'T',
      'questions': [
        {
          'id': '1',
          'topic': {'id': 't', 'name': 'Equações'},
          'statement': 'x + 2 = 5?',
          'options': [
            {'key': 'A', 'text': '2'},
            {'key': 'B', 'text': '3'},
          ],
          'difficulty': 'easy',
        },
      ],
    });
    expect(quiz.questions.single.topicName, 'Equações');
    expect(quiz.questions.single.options.map((o) => o.key), ['A', 'B']);
  });

  test('parses an attempt result, accepting int and double percentages', () {
    final r = AttemptResult.fromJson({
      'attemptId': 'a',
      'correctCount': 4,
      'totalCount': 8,
      'scorePct': 50,
      'topicResults': [
        {
          'topicName': 'E',
          'correctCount': 1,
          'totalCount': 4,
          'accuracyPct': 25.5,
        },
      ],
      'answers': [
        {
          'questionId': '1',
          'selectedOption': 'B',
          'correctOption': 'B',
          'isCorrect': true,
          'referenceExplanation': 'ok',
        },
      ],
    });
    expect(r.scorePct, 50.0);
    expect(r.topicResults.single.accuracyPct, 25.5);
    expect(r.answers.single.isCorrect, isTrue);
  });

  test('parses recommendations with and without suggestions', () {
    final r = Recommendations.fromJson({
      'status': 'NEEDS_REVIEW',
      'evaluatedAttempts': 1,
      'topics': [
        {
          'topicId': 't1',
          'topicName': 'Equações',
          'priority': 'LOW',
          'correctCount': 1,
          'answeredCount': 4,
          'accuracyPct': 25,
          'status': 'NO_NEW_QUESTIONS',
          'message': 'Revise',
          'suggestedQuestions': <dynamic>[],
        },
      ],
    });
    expect(r.topics.single.message, 'Revise');
    expect(r.topics.single.priority, 'LOW');
    expect(r.topics.single.topicId, 't1');
    expect(r.topics.single.suggestedQuestions, isEmpty);
  });

  test('request ids are valid, unique v4 UUIDs', () {
    final uuid = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    );
    final ids = {for (var i = 0; i < 50; i++) newRequestId()};
    expect(ids, hasLength(50));
    expect(ids.every(uuid.hasMatch), isTrue);
  });
}

void reviewQuizModelTests() {
  test('parses a review quiz with its counts, and defaults to standard', () {
    final review = Quiz.fromJson({
      'id': 'r',
      'slug': 'revisao-1',
      'title': 'Revisão: Equações',
      'kind': 'review',
      'newCount': 2,
      'retryCount': 1,
      'questions': <dynamic>[],
    });
    expect(review.isReview, isTrue);
    expect(review.newCount, 2);
    expect(review.retryCount, 1);

    final standard = Quiz.fromJson({
      'id': 'q',
      'slug': 'demo',
      'title': 'T',
      'questions': <dynamic>[],
    });
    expect(standard.isReview, isFalse);
    expect(standard.newCount, isNull);
  });
}
