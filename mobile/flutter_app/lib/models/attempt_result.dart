class TopicResult {
  const TopicResult({
    required this.topicName,
    required this.correctCount,
    required this.totalCount,
    required this.accuracyPct,
  });

  factory TopicResult.fromJson(Map<String, dynamic> json) => TopicResult(
    topicName: json['topicName'] as String,
    correctCount: json['correctCount'] as int,
    totalCount: json['totalCount'] as int,
    accuracyPct: (json['accuracyPct'] as num).toDouble(),
  );

  final String topicName;
  final int correctCount;
  final int totalCount;
  final double accuracyPct;
}

class AnswerResult {
  const AnswerResult({
    required this.questionId,
    required this.selectedOption,
    required this.correctOption,
    required this.isCorrect,
    required this.referenceExplanation,
  });

  factory AnswerResult.fromJson(Map<String, dynamic> json) => AnswerResult(
    questionId: json['questionId'] as String,
    selectedOption: json['selectedOption'] as String,
    correctOption: json['correctOption'] as String,
    isCorrect: json['isCorrect'] as bool,
    referenceExplanation: json['referenceExplanation'] as String,
  );

  final String questionId;
  final String selectedOption;
  final String correctOption;
  final bool isCorrect;
  final String referenceExplanation;
}

class AttemptResult {
  const AttemptResult({
    required this.attemptId,
    required this.correctCount,
    required this.totalCount,
    required this.scorePct,
    required this.topicResults,
    required this.answers,
  });

  factory AttemptResult.fromJson(Map<String, dynamic> json) => AttemptResult(
    attemptId: json['attemptId'] as String,
    correctCount: json['correctCount'] as int,
    totalCount: json['totalCount'] as int,
    scorePct: (json['scorePct'] as num).toDouble(),
    topicResults: (json['topicResults'] as List<dynamic>)
        .map((t) => TopicResult.fromJson(t as Map<String, dynamic>))
        .toList(),
    answers: (json['answers'] as List<dynamic>)
        .map((a) => AnswerResult.fromJson(a as Map<String, dynamic>))
        .toList(),
  );

  final String attemptId;
  final int correctCount;
  final int totalCount;
  final double scorePct;
  final List<TopicResult> topicResults;
  final List<AnswerResult> answers;
}
