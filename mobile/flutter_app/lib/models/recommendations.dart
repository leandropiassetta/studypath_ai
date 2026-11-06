import 'quiz.dart';

class TopicRecommendation {
  const TopicRecommendation({
    required this.topicId,
    required this.topicName,
    required this.priority,
    required this.correctCount,
    required this.answeredCount,
    required this.accuracyPct,
    required this.status,
    required this.suggestedQuestions,
    this.message,
    this.subject,
  });

  factory TopicRecommendation.fromJson(Map<String, dynamic> json) =>
      TopicRecommendation(
        topicId: json['topicId'] as String,
        topicName: json['topicName'] as String,
        priority: json['priority'] as String,
        correctCount: json['correctCount'] as int,
        answeredCount: json['answeredCount'] as int,
        accuracyPct: (json['accuracyPct'] as num).toDouble(),
        status: json['status'] as String,
        message: json['message'] as String?,
        subject: json['subject'] as String?,
        suggestedQuestions: (json['suggestedQuestions'] as List<dynamic>)
            .map((q) => Question.fromJson(q as Map<String, dynamic>))
            .toList(),
      );

  final String topicId;
  final String topicName;

  /// The subject (matéria) this topic belongs to, e.g. "Geografia".
  final String? subject;

  /// `HIGH` (accuracy < 60%) or `LOW` (optional review: some mistakes, >= 60%).
  final String priority;
  final int correctCount;
  final int answeredCount;
  final double accuracyPct;

  /// `AVAILABLE` or `NO_NEW_QUESTIONS`.
  final String status;
  final String? message;
  final List<Question> suggestedQuestions;
}

class ProgressTopic {
  const ProgressTopic({required this.topicName, required this.accuracyPct});

  factory ProgressTopic.fromJson(Map<String, dynamic> json) => ProgressTopic(
    topicName: json['topicName'] as String,
    accuracyPct: (json['accuracyPct'] as num).toDouble(),
  );

  final String topicName;
  final double accuracyPct;
}

/// Performance of one attempt; the list in [Recommendations.progress] is oldest first.
class ProgressPoint {
  const ProgressPoint({required this.scorePct, required this.topics});

  factory ProgressPoint.fromJson(Map<String, dynamic> json) => ProgressPoint(
    scorePct: (json['scorePct'] as num).toDouble(),
    topics: (json['topics'] as List<dynamic>)
        .map((t) => ProgressTopic.fromJson(t as Map<String, dynamic>))
        .toList(),
  );

  final double scorePct;
  final List<ProgressTopic> topics;
}

/// The evolution of one subject (always one simulado, so the scores are comparable).
class SubjectEvolution {
  const SubjectEvolution({required this.subject, required this.progress});

  factory SubjectEvolution.fromJson(Map<String, dynamic> json) =>
      SubjectEvolution(
        subject: json['subject'] as String,
        progress: (json['progress'] as List<dynamic>)
            .map((p) => ProgressPoint.fromJson(p as Map<String, dynamic>))
            .toList(),
      );

  final String subject;
  final List<ProgressPoint> progress;
}

class Recommendations {
  const Recommendations({
    required this.status,
    required this.evaluatedAttempts,
    required this.topics,
    this.progress = const [],
    this.subject,
    this.progressSubject,
    this.evolutions = const [],
  });

  factory Recommendations.fromJson(Map<String, dynamic> json) =>
      Recommendations(
        status: json['status'] as String,
        evaluatedAttempts: json['evaluatedAttempts'] as int,
        topics: (json['topics'] as List<dynamic>)
            .map((t) => TopicRecommendation.fromJson(t as Map<String, dynamic>))
            .toList(),
        progress: ((json['progress'] as List<dynamic>?) ?? const [])
            .map((p) => ProgressPoint.fromJson(p as Map<String, dynamic>))
            .toList(),
        subject: json['subject'] as String?,
        progressSubject: json['progressSubject'] as String?,
        evolutions: ((json['evolutions'] as List<dynamic>?) ?? const [])
            .map((e) => SubjectEvolution.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  /// `NO_HISTORY`, `ON_TRACK` or `NEEDS_REVIEW`.
  final String status;
  final int evaluatedAttempts;
  final List<TopicRecommendation> topics;

  /// Attempts in the evaluated window, oldest first.
  final List<ProgressPoint> progress;

  /// The subject this view was limited to, or null when it covers every subject.
  final String? subject;

  /// The subject the progress belongs to (progress is always about one simulado).
  final String? progressSubject;

  /// One evolution per subject the student has tried (only the asked subject when limited).
  /// Older servers do not send it; [evolutionsToShow] falls back to [progress].
  final List<SubjectEvolution> evolutions;

  List<SubjectEvolution> get evolutionsToShow => evolutions.isNotEmpty
      ? evolutions
      : progress.isEmpty
      ? const []
      : [SubjectEvolution(subject: progressSubject ?? '', progress: progress)];
}
