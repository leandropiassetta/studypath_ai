import 'package:flutter/material.dart';

import '../models/explanation.dart';
import '../services/api_client.dart';

/// "Explain my mistake" action for one wrongly answered question.
/// The explanation is text only: it never changes the score (RN-11).
class ExplanationTile extends StatefulWidget {
  const ExplanationTile({
    super.key,
    required this.api,
    required this.attemptId,
    required this.questionId,
  });

  final ApiClient api;
  final String attemptId;
  final String questionId;

  @override
  State<ExplanationTile> createState() => _ExplanationTileState();
}

class _ExplanationTileState extends State<ExplanationTile> {
  Explanation? _explanation;
  String? _error;
  bool _loading = false;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.api.fetchExplanation(
        attemptId: widget.attemptId,
        questionId: widget.questionId,
      );
      if (!mounted) return;
      setState(() {
        _explanation = result;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(8),
        child: SizedBox(
          height: 20,
          width: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    final explanation = _explanation;
    if (explanation != null) {
      return Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Chip(
              key: Key('source-${widget.questionId}'),
              label: Text(
                explanation.isAi
                    ? 'Explicação gerada por IA'
                    : 'Explicação de referência',
              ),
              visualDensity: VisualDensity.compact,
            ),
            Text(explanation.explanation),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        TextButton.icon(
          key: Key('explain-${widget.questionId}'),
          onPressed: _load,
          icon: const Icon(Icons.lightbulb_outline),
          label: Text(
            _error == null ? 'Explicar meu erro' : 'Tentar novamente',
          ),
        ),
      ],
    );
  }
}
