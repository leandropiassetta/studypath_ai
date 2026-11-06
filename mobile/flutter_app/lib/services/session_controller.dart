import 'package:flutter/foundation.dart';

import '../models/auth_session.dart';
import 'api_client.dart';

/// Holds the login session in memory and tells the app when to show the login screen.
/// The token is never persisted: closing the app logs the student out.
class SessionController extends ChangeNotifier {
  SessionController(this._api, {AuthSession? initial}) {
    _api.onUnauthorized = _expired;
    if (initial != null) _apply(initial);
  }

  final ApiClient _api;
  AuthSession? _session;
  String? _notice;

  AuthSession? get session => _session;
  bool get isLoggedIn => _session != null;

  /// A message for the login screen, e.g. "your session expired". Cleared on the next login.
  String? get notice => _notice;

  Future<void> login({required String email, required String password}) async {
    _apply(await _api.login(email: email, password: password));
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    _apply(await _api.register(name: name, email: email, password: password));
  }

  Future<void> logout() async {
    await _api.logout();
    _session = null;
    _notice = null;
    notifyListeners();
  }

  void _apply(AuthSession session) {
    _api.useSession(session);
    _session = session;
    _notice = null;
    notifyListeners();
  }

  void _expired() {
    if (_session == null) return;
    _api.clearSession();
    _session = null;
    _notice = 'Sua sessão expirou. Entre de novo.';
    notifyListeners();
  }
}
