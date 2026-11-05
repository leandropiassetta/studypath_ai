class Explanation {
  const Explanation({
    required this.questionId,
    required this.explanation,
    required this.source,
    this.notice,
  });

  factory Explanation.fromJson(Map<String, dynamic> json) => Explanation(
    questionId: json['questionId'] as String,
    explanation: json['explanation'] as String,
    source: json['source'] as String,
    notice: json['notice'] as String?,
  );

  final String questionId;
  final String explanation;

  /// `llm` or `reference` (fallback when the AI is disabled or unavailable).
  final String source;

  /// Set when the AI was skipped on purpose (usage limit): tells the user why.
  final String? notice;

  bool get isAi => source == 'llm';
}
