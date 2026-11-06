/// One simulado in the list the student chooses from (no questions, no answer keys).
class QuizSummary {
  const QuizSummary({
    required this.id,
    required this.slug,
    required this.title,
    required this.questionCount,
    required this.topics,
  });

  factory QuizSummary.fromJson(Map<String, dynamic> json) => QuizSummary(
    id: json['id'] as String,
    slug: json['slug'] as String,
    title: json['title'] as String,
    questionCount: json['questionCount'] as int,
    topics: (json['topics'] as List<dynamic>)
        .map((t) => (t as Map<String, dynamic>)['name'] as String)
        .toList(),
  );

  final String id;
  final String slug;
  final String title;
  final int questionCount;
  final List<String> topics;
}
