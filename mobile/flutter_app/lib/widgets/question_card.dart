import 'package:flutter/material.dart';

import '../models/quiz.dart';

String difficultyLabel(String difficulty) => switch (difficulty) {
  'easy' => 'Fácil',
  'medium' => 'Média',
  'hard' => 'Difícil',
  _ => difficulty,
};

class QuestionCard extends StatelessWidget {
  const QuestionCard({
    super.key,
    required this.index,
    required this.question,
    this.selected,
    this.onSelected,
    this.readOnly = false,
  });

  final int index;
  final Question question;
  final String? selected;

  /// Null disables the options (e.g. while submitting).
  final ValueChanged<String>? onSelected;

  /// Shows the options as plain text, without radio buttons (recommended exercises
  /// cannot be answered in this version).
  final bool readOnly;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 6),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            children: [
              if (question.topicName != null)
                Text(
                  question.topicName!,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              Text(
                difficultyLabel(question.difficulty),
                key: Key('difficulty-${question.id}'),
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
          Text(
            '$index. ${question.statement}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          if (readOnly)
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final o in question.options)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Text(
                        '${o.key}) ${o.text}',
                        key: Key('option-${question.id}-${o.key}'),
                      ),
                    ),
                ],
              ),
            )
          else
            RadioGroup<String>(
              groupValue: selected,
              onChanged: (v) {
                if (v != null) onSelected?.call(v);
              },
              child: Column(
                children: [
                  for (final o in question.options)
                    RadioListTile<String>(
                      key: Key('option-${question.id}-${o.key}'),
                      value: o.key,
                      enabled: onSelected != null,
                      title: Text('${o.key}) ${o.text}'),
                      dense: true,
                    ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}
