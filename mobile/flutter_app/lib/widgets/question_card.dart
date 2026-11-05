import 'package:flutter/material.dart';

import '../models/quiz.dart';

class QuestionCard extends StatelessWidget {
  const QuestionCard({
    super.key,
    required this.index,
    required this.question,
    this.selected,
    this.onSelected,
  });

  final int index;
  final Question question;
  final String? selected;

  /// Null makes the card read-only (used by the recommendations list).
  final ValueChanged<String>? onSelected;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 6),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (question.topicName != null)
            Text(
              question.topicName!,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          Text(
            '$index. ${question.statement}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
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
