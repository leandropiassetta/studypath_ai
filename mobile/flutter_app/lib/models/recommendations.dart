import 'quiz.dart';

class TopicRecommendation {
  const TopicRecommendation({
    required this.topicName,
    required this.correctCount,
    required this.answeredCount,
    required this.accuracyPct,
    required this.status,
    required this.suggestedQuestions,
    this.message,
  });

  factory TopicRecommendation.fromJson(Map<String, dynamic> json) =>
      TopicRecommendation(
        topicName: json['topicName'] as String,
        correctCount: json['correctCount'] as int,
        answeredCount: json['answeredCount'] as int,
        accuracyPct: (json['accuracyPct'] as num).toDouble(),
        status: json['status'] as String,
        message: json['message'] as String?,
        suggestedQuestions: (json['suggestedQuestions'] as List<dynamic>)
            .map((q) => Question.fromJson(q as Map<String, dynamic>))
            .toList(),
      );

  final String topicName;
  final int correctCount;
  final int answeredCount;
  final double accuracyPct;

  /// `AVAILABLE` or `NO_NEW_QUESTIONS`.
  final String status;
  final String? message;
  final List<Question> suggestedQuestions;
}

class Recommendations {
  const Recommendations({
    required this.status,
    required this.evaluatedAttempts,
    required this.topics,
  });

  factory Recommendations.fromJson(Map<String, dynamic> json) =>
      Recommendations(
        status: json['status'] as String,
        evaluatedAttempts: json['evaluatedAttempts'] as int,
        topics: (json['topics'] as List<dynamic>)
            .map((t) => TopicRecommendation.fromJson(t as Map<String, dynamic>))
            .toList(),
      );

  /// `NO_HISTORY`, `ON_TRACK` or `NEEDS_REVIEW`.
  final String status;
  final int evaluatedAttempts;
  final List<TopicRecommendation> topics;
}
