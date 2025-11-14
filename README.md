# Inspection Flutter App

A comprehensive Flutter application for managing inspection workflows, built with modern architecture patterns and best practices.

## 🏗️ Project Structure

```
lib/
├── config/                 # App configuration
│   └── app_config.dart     # Centralized configuration
├── providers/              # State management
│   ├── auth_provider.dart  # Authentication state
│   └── inspection_provider.dart # Inspection data state
├── services/               # API services
│   ├── api.dart           # Main API client
│   └── answer_service.dart # Answer submission service
├── utils/                  # Utility functions
│   ├── api_response_parser.dart # API response parsing
│   └── error_handler.dart  # Error handling utilities
├── widgets/                # Reusable widgets
│   ├── common/            # Common UI components
│   │   └── app_components.dart
│   ├── app_curved_navbar.dart
│   └── assigned_list.dart
├── pages/                  # App screens
│   ├── auth/              # Authentication pages
│   │   └── login_page.dart
│   ├── dashboard_page.dart
│   ├── inspection_page.dart
│   └── ...
├── assets/                 # App assets
│   ├── app_colors.dart    # Color definitions
│   └── images/           # Image assets
├── app.dart               # Main app widget
└── main.dart             # App entry point
```

## 🚀 Features

- **Centralized State Management**: Using Provider pattern for efficient state management
- **Centralized API Configuration**: Environment-based configuration with proper error handling
- **Reusable UI Components**: Consistent design system with common components
- **Comprehensive Error Handling**: User-friendly error messages and loading states
- **Type Safety**: Strong typing throughout the application
- **Performance Optimized**: Efficient data loading and caching strategies

## 🛠️ Setup & Installation

### Prerequisites
- Flutter SDK (3.9.0 or higher)
- Dart SDK
- Android Studio / VS Code
- Git

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inspection_app/inspection_flutter_app
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Run the app**
   ```bash
   flutter run
   ```

## 🔧 Configuration

### Environment Variables
The app uses centralized configuration in `lib/config/app_config.dart`:

```dart
class AppConfig {
  static String get apiBaseUrl {
    // Returns appropriate URL based on platform
  }
  
  static const Duration apiTimeout = Duration(seconds: 30);
  static const bool enableDebugLogging = kDebugMode;
  // ... other configurations
}
```

### API Configuration
- **Web**: `http://localhost:4555`
- **Mobile**: `http://192.168.0.6:4555`

## 📱 Usage

### Authentication
The app uses a centralized authentication system:

```dart
// Login
final authProvider = Provider.of<AuthProvider>(context, listen: false);
await authProvider.login(email, password);

// Check authentication status
if (authProvider.isAuthenticated) {
  // User is logged in
}
```

### State Management
The app uses Provider for state management:

```dart
// Access inspection data
final inspectionProvider = Provider.of<InspectionProvider>(context);
final inspections = inspectionProvider.assignedInspections;

// Load data
await inspectionProvider.loadAssignedInspections();
```

### UI Components
Use the centralized UI components for consistency:

```dart
// Primary button
AppComponents.primaryButton(
  text: 'Submit',
  onPressed: () {},
  isLoading: false,
);

// Text field
AppComponents.textField(
  controller: controller,
  labelText: 'Email',
  validator: (value) => value?.isEmpty == true ? 'Required' : null,
);
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/app_test.dart

# Run with coverage
flutter test --coverage
```

### Test Structure
- **Unit Tests**: Test individual functions and classes
- **Widget Tests**: Test UI components
- **Integration Tests**: Test complete user flows

## 🔍 Code Quality

### Linting
The project uses `flutter_lints` for code quality:

```bash
# Analyze code
flutter analyze

# Fix auto-fixable issues
dart fix --apply
```

### Code Style
- Follow Dart/Flutter conventions
- Use meaningful variable and function names
- Add documentation for public APIs
- Keep functions small and focused

## 🚀 Performance

### Optimization Strategies
- **Lazy Loading**: Load data only when needed
- **Caching**: Cache frequently accessed data
- **Image Optimization**: Use appropriate image formats and sizes
- **State Management**: Minimize unnecessary rebuilds

### Monitoring
- Use Flutter DevTools for performance monitoring
- Monitor memory usage and widget rebuilds
- Profile network requests and API calls

## 🔒 Security

### Best Practices
- **No Hardcoded Secrets**: Use environment variables
- **Input Validation**: Validate all user inputs
- **API Security**: Use proper authentication tokens
- **Data Encryption**: Encrypt sensitive data

### Authentication
- JWT token-based authentication
- Automatic token refresh
- Secure token storage using SharedPreferences

## 📚 API Documentation

### Endpoints
- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Inspections**: `/api/inspections/*`
- **Users**: `/api/users/*`
- **Templates**: `/api/templates/*`

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Build Errors**
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

2. **API Connection Issues**
   - Check network connectivity
   - Verify API server is running
   - Check API URL configuration

3. **State Management Issues**
   - Ensure Provider is properly set up
   - Check for memory leaks
   - Verify state updates

### Debug Mode
Enable debug logging in `AppConfig.enableDebugLogging` for detailed logs.

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes with tests
3. Run tests and linting
4. Submit pull request

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Last Updated**: December 2024
**Version**: 1.0.0