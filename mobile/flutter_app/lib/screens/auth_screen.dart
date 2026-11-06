import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import '../services/session_controller.dart';
import '../widgets/centered_content.dart';

enum AuthMode { login, register }

final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Validators are plain functions so they can be tested without pumping a widget.
String? validateName(String? value) {
  final name = value?.trim() ?? '';
  if (name.isEmpty) return 'Informe seu nome';
  if (name.length > 80) return 'Use no máximo 80 caracteres';
  return null;
}

String? validateEmail(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty) return 'Informe seu e-mail';
  if (email.length > 254 || !_emailPattern.hasMatch(email)) {
    return 'Informe um e-mail válido, como nome@exemplo.com';
  }
  return null;
}

const int minPasswordLength = 6;
const int maxPasswordLength = 128;

String? validateNewPassword(String? value) {
  final password = value ?? '';
  if (password.isEmpty) return 'Crie uma senha';
  if (password.length < minPasswordLength) {
    return 'A senha precisa ter pelo menos $minPasswordLength caracteres';
  }
  if (password.length > maxPasswordLength) {
    return 'Use no máximo $maxPasswordLength caracteres';
  }
  return null;
}

String? validateExistingPassword(String? value) =>
    (value == null || value.isEmpty) ? 'Informe sua senha' : null;

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.controller});

  final SessionController controller;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();

  AuthMode _mode = AuthMode.login;
  bool _hidePassword = true;
  bool _submitting = false;
  String? _error;

  bool get _isRegister => _mode == AuthMode.register;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _setMode(AuthMode mode) {
    if (mode == _mode) return;
    setState(() {
      _mode = mode;
      _error = null;
      _formKey.currentState?.reset();
    });
  }

  Future<void> _submit() async {
    if (_submitting || !_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      if (_isRegister) {
        await widget.controller.register(
          name: _name.text.trim(),
          email: email,
          password: _password.text,
        );
      } else {
        await widget.controller.login(email: email, password: _password.text);
      }
      TextInput.finishAutofillContext();
      // On success the app swaps this screen for the quiz; nothing else to do here.
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notice = widget.controller.notice;
    return Scaffold(
      body: SafeArea(
        child: CenteredContent(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: AutofillGroup(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),
                    Semantics(
                      header: true,
                      child: Text(
                        'StudyPath AI',
                        style: theme.textTheme.headlineMedium,
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Simulados com recomendações de estudo',
                      style: theme.textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    SegmentedButton<AuthMode>(
                      key: const Key('auth-mode'),
                      segments: const [
                        ButtonSegment(
                          value: AuthMode.login,
                          label: Text('Entrar'),
                        ),
                        ButtonSegment(
                          value: AuthMode.register,
                          label: Text('Criar conta'),
                        ),
                      ],
                      selected: {_mode},
                      onSelectionChanged: _submitting
                          ? null
                          : (selection) => _setMode(selection.first),
                    ),
                    const SizedBox(height: 16),
                    if (notice != null && _error == null)
                      _Banner(key: const Key('auth-notice'), message: notice),
                    if (_error != null)
                      _Banner(
                        key: const Key('auth-error'),
                        message: _error!,
                        isError: true,
                      ),
                    if (_isRegister) ...[
                      TextFormField(
                        key: const Key('field-name'),
                        controller: _name,
                        enabled: !_submitting,
                        decoration: const InputDecoration(
                          labelText: 'Nome',
                          border: OutlineInputBorder(),
                        ),
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.name],
                        validator: validateName,
                        onFieldSubmitted: (_) => _emailFocus.requestFocus(),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      key: const Key('field-email'),
                      controller: _email,
                      focusNode: _emailFocus,
                      enabled: !_submitting,
                      decoration: const InputDecoration(
                        labelText: 'E-mail',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      enableSuggestions: false,
                      autofillHints: const [AutofillHints.email],
                      validator: validateEmail,
                      onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('field-password'),
                      controller: _password,
                      focusNode: _passwordFocus,
                      enabled: !_submitting,
                      decoration: InputDecoration(
                        labelText: 'Senha',
                        helperText: _isRegister
                            ? 'Mínimo de $minPasswordLength caracteres'
                            : null,
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          key: const Key('toggle-password'),
                          tooltip: _hidePassword
                              ? 'Mostrar senha'
                              : 'Ocultar senha',
                          icon: Icon(
                            _hidePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () =>
                              setState(() => _hidePassword = !_hidePassword),
                        ),
                      ),
                      obscureText: _hidePassword,
                      autocorrect: false,
                      enableSuggestions: false,
                      textInputAction: TextInputAction.done,
                      autofillHints: [
                        _isRegister
                            ? AutofillHints.newPassword
                            : AutofillHints.password,
                      ],
                      validator: _isRegister
                          ? validateNewPassword
                          : validateExistingPassword,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      key: const Key('auth-submit'),
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isRegister ? 'Criar conta' : 'Entrar'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({super.key, required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true, // screen readers announce it when it appears
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isError ? scheme.errorContainer : scheme.secondaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          message,
          style: TextStyle(
            color: isError
                ? scheme.onErrorContainer
                : scheme.onSecondaryContainer,
          ),
        ),
      ),
    );
  }
}
