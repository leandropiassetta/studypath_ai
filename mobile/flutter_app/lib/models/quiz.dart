class AnswerOption {
  const AnswerOption({required this.key, required this.text});

  factory AnswerOption.fromJson(Map<String, dynamic> json) =>
      AnswerOption(key: json['key'] as String, text: json['text'] as String);

  final String key;
  final String text;
}

class Question {
  const Question({
    required this.id,
    required this.statement,
    required this.options,
    required this.difficulty,
    this.topicName,
  });

  factory Question.fromJson(Map<String, dynamic> json) => Question(
    id: json['id'] as String,
    statement: json['statement'] as String,
    options: (json['options'] as List<dynamic>)
        .map((o) => AnswerOption.fromJson(o as Map<String, dynamic>))
        .toList(),
    difficulty: json['difficulty'] as String,
    topicName: (json['topic'] as Map<String, dynamic>?)?['name'] as String?,
  );

  final String id;
  final String statement;
  final List<AnswerOption> options;
  final String difficulty;

  /// Present in quiz questions; absent in recommendation suggestions
  /// (the screen fills it from the topic the suggestion is listed under).
  final String? topicName;

  Question withTopicName(String name) => Question(
    id: id,
    statement: statement,
    options: options,
    difficulty: difficulty,
    topicName: name,
  );
}

class Quiz {
  const Quiz({
    required this.id,
    required this.slug,
    required this.title,
    required this.questions,
    this.kind = 'standard',
    this.newCount,
    this.retryCount,
  });

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
    id: json['id'] as String,
    slug: json['slug'] as String,
    title: json['title'] as String,
    kind: (json['kind'] as String?) ?? 'standard',
    newCount: json['newCount'] as int?,
    retryCount: json['retryCount'] as int?,
    questions: (json['questions'] as List<dynamic>)
        .map((q) => Question.fromJson(q as Map<String, dynamic>))
        .toList(),
  );

  final String id;
  final String slug;
  final String title;
  final List<Question> questions;

  /// `standard` (the demo quiz) or `review` (generated from a topic recommendation).
  final String kind;

  /// Review quizzes only: questions never answered / questions answered wrongly before.
  final int? newCount;
  final int? retryCount;

  bool get isReview => kind == 'review';
}
