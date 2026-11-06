import 'package:flutter/material.dart';

import '../models/recommendations.dart';
import '../utils/contrast.dart';
import '../screens/result_screen.dart' show formatPct;

/// Percentage-point change between the last two values, or null with fewer than two.
double? progressDelta(List<double> values) =>
    values.length < 2 ? null : values.last - values[values.length - 2];

String formatDelta(double delta) {
  if (delta.abs() < 0.005) return '= sem mudança';
  final points = formatPct(delta.abs()).replaceAll('%', '');
  return delta > 0 ? '▲ +$points pts' : '▼ −$points pts';
}

/// Trajectory per attempt (overall and by topic). Honest by design: attempts reuse the same
/// questions, so this shows performance over time, not proof of learning.
class ProgressSection extends StatelessWidget {
  const ProgressSection({super.key, required this.progress});

  final List<ProgressPoint> progress;

  @override
  Widget build(BuildContext context) {
    if (progress.isEmpty) return const SizedBox.shrink();

    final topicNames = {
      for (final p in progress) ...p.topics.map((t) => t.topicName),
    }.toList()..sort();
    final theme = Theme.of(context);

    return Card(
      key: const Key('progress-section'),
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sua evolução nos simulados completos',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _Row(
              label: 'Nota geral',
              values: [for (final p in progress) p.scorePct],
            ),
            for (final name in topicNames)
              _Row(
                label: name,
                values: [
                  for (final p in progress)
                    for (final t in p.topics)
                      if (t.topicName == name) t.accuracyPct,
                ],
              ),
            const SizedBox(height: 8),
            Text(
              'Da mais antiga para a mais recente (só simulados completos do mesmo assunto). Eles usam as mesmas '
              'questões: a evolução mostra desempenho, não prova aprendizado.',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.values});

  final String label;
  final List<double> values;

  @override
  Widget build(BuildContext context) {
    final delta = progressDelta(values);
    final surface = Theme.of(context).colorScheme.surface;
    final color = delta == null || delta.abs() < 0.005
        ? null
        : ensureContrast(delta > 0 ? Colors.green : Colors.red, surface);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Wrap(
        spacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('$label:', style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(values.map(formatPct).join(' → ')),
          if (delta != null)
            Text(
              formatDelta(delta),
              key: Key('delta-$label'),
              style: TextStyle(color: color),
            ),
        ],
      ),
    );
  }
}
