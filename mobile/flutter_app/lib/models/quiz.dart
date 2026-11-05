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

  /// Present in quiz questions; absent in recommendation suggestions.
  final String? topicName;
}

class Quiz {
  const Quiz({
    required this.id,
    required this.slug,
    required this.title,
    required this.questions,
  });

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
    id: json['id'] as String,
    slug: json['slug'] as String,
    title: json['title'] as String,
    questions: (json['questions'] as List<dynamic>)
        .map((q) => Question.fromJson(q as Map<String, dynamic>))
        .toList(),
  );

  final String id;
  final String slug;
  final String title;
  final List<Question> questions;
}
