import 'package:flutter/material.dart';
import 'package:app/services/api.dart';

/// Users management page
/// Created by: Munhb
class RepairPage extends StatefulWidget {
  const RepairPage({super.key});

  @override
  State<RepairPage> createState() => _RepairPageState();
}

class _RepairPageState extends State<RepairPage> with TickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _users = [];
  bool _isLoadingUsers = true;
  String _usersError = '';
  String? _selectedUserId;
  Map<String, dynamic>? _selectedUserDetails;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 1, vsync: this);
    _loadUsers();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// Load users from API
  Future<void> _loadUsers() async {
    try {
      setState(() {
        _isLoadingUsers = true;
        _usersError = '';
      });

      final response = await UserAPI.getAll();
      final users = _parseApiResponse(response);

      setState(() {
        _users = users;
        _isLoadingUsers = false;
      });
    } catch (e) {
      setState(() {
        _usersError = 'Хэрэглэгчдийн мэдээлэл татахад алдаа гарлаа: $e';
        _isLoadingUsers = false;
        _users = [];
      });
    }
  }

  /// Parse API response to extract data
  List<dynamic> _parseApiResponse(dynamic response) {
    if (response is Map<String, dynamic>) {
      final data =
          response['data'] ??
          response['items'] ??
          response['result'] ??
          response['users'] ??
          response['rows'];
      return data is List ? data : [];
    }
    return response is List ? response : [];
  }

  /// Handle user selection
  void _onUserSelected(String? userId) {
    setState(() {
      _selectedUserId = userId;
      _selectedUserDetails = userId != null
          ? _users.firstWhere(
              (user) => user['id'].toString() == userId,
              orElse: () => null,
            )
          : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: TabBar(
        controller: _tabController,
        tabs: const [Tab(text: 'Хэрэглэгчид')],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildUsersTab()],
      ),
    );
  }

  /// Build users tab content
  Widget _buildUsersTab() {
    return _buildTabContent(
      isLoading: _isLoadingUsers,
      error: _usersError,
      isEmpty: _users.isEmpty,
      onRefresh: _loadUsers,
      emptyIcon: Icons.people,
      emptyText: 'Хэрэглэгч олдсонгүй',
      content: _buildUserSelection(),
    );
  }

  /// Generic tab content builder
  Widget _buildTabContent({
    required bool isLoading,
    required String error,
    required bool isEmpty,
    required Future<void> Function() onRefresh,
    required IconData emptyIcon,
    required String emptyText,
    required Widget content,
  }) {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty) return _buildErrorWidget(error, onRefresh);
    if (isEmpty) return _buildEmptyWidget(emptyIcon, emptyText);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: Padding(padding: const EdgeInsets.all(16.0), child: content),
    );
  }

  /// Build error widget
  Widget _buildErrorWidget(String error, VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text(
            error,
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.red[600]),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Дахин оролдох'),
          ),
        ],
      ),
    );
  }

  /// Build empty widget
  Widget _buildEmptyWidget(IconData icon, String text) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(text, style: const TextStyle(fontSize: 18, color: Colors.grey)),
        ],
      ),
    );
  }

  /// Build user selection interface
  Widget _buildUserSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSelectionCard(
          title: 'Хэрэглэгч сонгох:',
          hint: 'Хэрэглэгчийн ID сонгоно уу',
          value: _selectedUserId,
          items: _users,
          onChanged: _onUserSelected,
          itemBuilder: _buildUserItem,
        ),
        const SizedBox(height: 16),
        if (_selectedUserDetails != null) ...[
          _buildDetailsCard(
            icon: Icons.person,
            title: 'Хэрэглэгчийн дэлгэрэнгүй мэдээлэл',
            color: Colors.purple,
            details: _selectedUserDetails!,
            builder: _buildUserDetailsTable,
          ),
        ] else if (_selectedUserId != null) ...[
          _buildNotFoundCard('Сонгосон хэрэглэгчийн мэдээлэл олдсонгүй'),
        ],
      ],
    );
  }

  /// Build selection card
  Widget _buildSelectionCard({
    required String title,
    required String hint,
    required String? value,
    required List<dynamic> items,
    required ValueChanged<String?> onChanged,
    required Widget Function(Map<String, dynamic>) itemBuilder,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: value,
              hint: Text(hint),
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
              ),
              items: items.map<DropdownMenuItem<String>>((item) {
                final itemMap = item as Map<String, dynamic>;
                final id = itemMap['id']?.toString() ?? '';
                return DropdownMenuItem<String>(
                  value: id,
                  child: itemBuilder(itemMap),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ],
        ),
      ),
    );
  }

  /// Build user dropdown item
  Widget _buildUserItem(Map<String, dynamic> user) {
    final id = user['id']?.toString() ?? '';
    final email = user['email']?.toString() ?? '';
    final fullName = user['fullName']?.toString() ?? '';
    final displayName = fullName.isNotEmpty ? fullName : email;
    final displayText = displayName.isNotEmpty ? '$id - $displayName' : id;
    return Text(displayText);
  }

  /// Build details card
  Widget _buildDetailsCard({
    required IconData icon,
    required String title,
    required Color color,
    required Map<String, dynamic> details,
    required Widget Function(Map<String, dynamic>) builder,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            builder(details),
          ],
        ),
      ),
    );
  }

  /// Build not found card
  Widget _buildNotFoundCard(String message) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text(message, style: const TextStyle(color: Colors.orange)),
      ),
    );
  }

  /// Build user details table
  Widget _buildUserDetailsTable(Map<String, dynamic> details) {
    final userData = <String, dynamic>{};

    // Extract only essential user fields for display
    if (details['id'] != null) userData['ID'] = details['id'].toString();
    if (details['email'] != null)
      userData['И-мэйл'] = details['email'].toString();
    if (details['fullName'] != null &&
        details['fullName'].toString().isNotEmpty) {
      userData['Бүтэн нэр'] = details['fullName'].toString();
    }
    if (details['phone'] != null)
      userData['Утас'] = details['phone'].toString();

    if (userData.isEmpty) {
      return _buildNotFoundCard('Энэ хэрэглэгчид мэдээлэл байхгүй байна.');
    }

    return _buildTable(userData);
  }

  /// Build table widget
  Widget _buildTable(Map<String, dynamic> data) {
    return Table(
      columnWidths: const {0: FlexColumnWidth(1), 1: FlexColumnWidth(2)},
      border: TableBorder.all(color: Colors.grey[300]!, width: 1),
      children: data.entries.map((entry) {
        return TableRow(
          children: [
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(
                _getColumnDisplayName(entry.key),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Text(
                entry.value?.toString() ?? '',
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ],
        );
      }).toList(),
    );
  }

  /// Get display name for column
  String _getColumnDisplayName(String key) {
    switch (key.toLowerCase()) {
      case 'firmware':
        return 'Firmware хувилбар';
      case 'location':
        return 'Байршил';
      case 'metadata':
        return 'Нэмэлт мэдээлэл';
      case 'model':
        return 'Загвар';
      case 'id':
        return 'ID';
      case 'email':
        return 'И-мэйл';
      case 'fullname':
        return 'Бүтэн нэр';
      case 'phone':
        return 'Утас';
      default:
        return key.replaceAll('_', ' ').toUpperCase();
    }
  }
}
