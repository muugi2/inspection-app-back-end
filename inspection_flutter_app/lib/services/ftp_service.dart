import 'dart:io';

import 'package:ftpconnect/ftpconnect.dart';

import '../config/app_config.dart';
import '../utils/app_logger.dart';

class FtpUploadResult {
  FtpUploadResult({
    required this.remoteFileName,
    required this.relativePath,
    required this.publicUrl,
    required this.fileSize,
  });

  final String remoteFileName;
  final String relativePath;
  final String publicUrl;
  final int fileSize;

  Map<String, dynamic> toPayload(int order) {
    return {
      'order': order,
      'fileName': remoteFileName,
      'fileSize': fileSize,
      'relativePath': relativePath,
      'imageUrl': publicUrl,
    };
  }
}

class FtpService {
  const FtpService._();

  static Future<List<FtpUploadResult>> uploadImages({
    required List<File> files,
    required String inspectionId,
    required String answerId,
    required String fieldId,
  }) async {
    if (files.isEmpty) {
      return const [];
    }

    final ftpConnect = FTPConnect(
      AppConfig.ftpHost,
      port: AppConfig.ftpPort,
      user: AppConfig.ftpUser,
      pass: AppConfig.ftpPassword,
      timeout: AppConfig.ftpTimeout.inSeconds,
      showLog: AppConfig.enableDebugLogging,
      securityType: SecurityType.ftp,
    );

    final List<FtpUploadResult> results = [];
    var isConnected = false;

    try {
      AppLogger.debug(
        'Connecting to FTP ${AppConfig.ftpHost}:${AppConfig.ftpPort}',
      );

      // Try to connect with retry mechanism
      int retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !isConnected) {
        try {
          isConnected = await ftpConnect.connect();
          if (isConnected) {
            AppLogger.debug('✅ FTP холболт амжилттай үүслээ');
            break;
          } else {
            throw FTPConnectException('FTP connect буцсан утга false');
          }
        } catch (e) {
          retries++;
          AppLogger.warning(
            'FTP холболт амжилтгүй (оролдлого $retries/$maxRetries): $e',
          );
          if (retries < maxRetries) {
            await Future.delayed(Duration(seconds: retries * 2));
          }
        }
      }

      if (!isConnected) {
        throw Exception(
          'FTP сервертэй холбогдож чадсангүй (${AppConfig.ftpHost}:${AppConfig.ftpPort}). '
          'USB холболтоо шалгаж, дахин оролдоно уу.',
        );
      }

      // Enable passive mode for better compatibility with USB/network connections
      try {
        await ftpConnect.setTransferType(TransferType.binary);
        AppLogger.debug('FTP transfer type set to binary');
      } catch (e) {
        AppLogger.warning('Could not set transfer type to binary: $e');
      }

      final remoteDirectory = AppConfig.ftpRemoteDirectory.trim();
      if (remoteDirectory.isNotEmpty && remoteDirectory != '/') {
        final bool ensured = await _ensureDirectoryAndChange(
          ftpConnect,
          remoteDirectory,
        );
        if (!ensured) {
          throw Exception('Failed to change to FTP directory $remoteDirectory');
        }
      }

      final timestamp = DateTime.now().millisecondsSinceEpoch;

      for (int index = 0; index < files.length; index++) {
        final file = files[index];
        if (!file.existsSync()) {
          AppLogger.warning('Файл олдсонгүй: ${file.path}');
          continue;
        }

        final fileSize = await file.length();
        AppLogger.debug(
          'Файлын хэмжээ: ${(fileSize / 1024).toStringAsFixed(2)} KB',
        );

        final extension = _extensionFromPath(file.path);
        final remoteFileName = _buildRemoteFileName(
          inspectionId: inspectionId,
          answerId: answerId,
          fieldId: fieldId,
          index: index,
          timestamp: timestamp,
          extension: extension,
        );

        // Retry logic for individual file upload
        bool uploadSuccess = false;
        int uploadRetries = 0;
        const maxUploadRetries = 2;
        Exception? lastError;

        while (!uploadSuccess && uploadRetries <= maxUploadRetries) {
          try {
            AppLogger.debug(
              '📤 Файл илгээж байна (${index + 1}/${files.length}): ${file.path} -> $remoteFileName',
            );

            final uploaded = await ftpConnect.uploadFile(
              file,
              sRemoteName: remoteFileName,
            );

            if (!uploaded) {
              throw Exception('FTP upload буцаж ирсэн утга false');
            }

            // Verify the file was uploaded by checking its size
            try {
              final remoteSize = await ftpConnect.sizeFile(remoteFileName);
              if (remoteSize > 0 && remoteSize != fileSize) {
                AppLogger.warning(
                  'Файлын хэмжээ таарахгүй байна. Орон нутгийнх: $fileSize, Сервер дээрх: $remoteSize',
                );
              } else if (remoteSize > 0) {
                AppLogger.debug(
                  '✅ Файлын хэмжээ баталгаажлаа: $remoteSize bytes',
                );
              }
            } catch (e) {
              // Size verification failed, but upload might have succeeded
              AppLogger.debug('Файлын хэмжээ шалгах боломжгүй: $e');
            }

            final relativePath = _buildRelativePath(remoteFileName);
            final publicUrl = _buildPublicUrl(remoteFileName);

            results.add(
              FtpUploadResult(
                remoteFileName: remoteFileName,
                relativePath: relativePath,
                publicUrl: publicUrl,
                fileSize: fileSize,
              ),
            );

            uploadSuccess = true;
            AppLogger.debug('✅ Файл амжилттай илгээгдлээ: $remoteFileName');
          } catch (error, stackTrace) {
            lastError = Exception(error.toString());
            uploadRetries++;

            if (uploadRetries <= maxUploadRetries) {
              AppLogger.warning(
                '⚠️ Файл илгээх алдаа гарлаа (оролдлого $uploadRetries/$maxUploadRetries): $error',
              );
              await Future.delayed(Duration(seconds: uploadRetries * 2));
            } else {
              AppLogger.error(
                '❌ Файл илгээх бүх оролдлого амжилтгүй боллоо: ${file.path}',
              );
              AppLogger.error('Алдааны дэлгэрэнгүй: $error');
              AppLogger.debug(stackTrace.toString());
              _logUploadFailure(file.path, error);
              rethrow;
            }
          }
        }

        if (!uploadSuccess && lastError != null) {
          throw lastError;
        }
      }
    } finally {
      try {
        AppLogger.debug('Disconnecting from FTP');
        if (isConnected) {
          await ftpConnect.disconnect();
        }
      } catch (error) {
        AppLogger.warning('Failed to disconnect from FTP: $error');
      }
    }

    if (results.isEmpty) {
      throw Exception('Зургууд FTP-д хадгалагдсангүй.');
    }

    return results;
  }

  static Future<bool> _ensureDirectoryAndChange(
    FTPConnect ftpConnect,
    String remoteDirectory,
  ) async {
    final normalized = _normalizeRemoteDirectory(remoteDirectory);
    if (normalized.isEmpty) {
      return true;
    }

    // First try a set of direct candidates
    for (final candidate in _buildDirectoryCandidates(
      normalized,
      remoteDirectory,
    )) {
      if (await _safeChangeDirectory(ftpConnect, candidate)) {
        return true;
      }
    }

    // Fallback: walk the tree and create missing segments if needed.
    final segments = normalized.split('/');
    if (segments.isEmpty) {
      return true;
    }

    // Attempt to go to root if possible; ignore failure.
    await _safeChangeDirectory(ftpConnect, '/');

    for (final segment in segments) {
      if (segment.isEmpty) {
        continue;
      }

      final changed = await _safeChangeDirectory(ftpConnect, segment);
      if (changed) {
        continue;
      }

      // Directory might not exist; try to create then change
      try {
        AppLogger.debug('Creating remote directory segment: $segment');
        final created = await ftpConnect.makeDirectory(segment);
        if (!created) {
          AppLogger.warning('Failed to create directory segment: $segment');
          return false;
        }
      } catch (error) {
        AppLogger.error('Error creating directory segment "$segment": $error');
        return false;
      }

      if (!await _safeChangeDirectory(ftpConnect, segment)) {
        AppLogger.warning(
          'Unable to change into directory segment after creation: $segment',
        );
        return false;
      }
    }

    return true;
  }

  static String _extensionFromPath(String path) {
    final dotIndex = path.lastIndexOf('.');
    if (dotIndex == -1 || dotIndex == path.length - 1) {
      return 'jpg';
    }
    return path.substring(dotIndex + 1).toLowerCase();
  }

  static String _buildRemoteFileName({
    required String inspectionId,
    required String answerId,
    required String fieldId,
    required int index,
    required int timestamp,
    required String extension,
  }) {
    final sanitizedExtension = extension.isEmpty ? 'jpg' : extension;
    return 'inspection_${inspectionId}_ans_${answerId}_field_${fieldId}_${timestamp}_$index.$sanitizedExtension';
  }

  static String _buildRelativePath(String remoteFileName) {
    return remoteFileName;
  }

  static String _buildPublicUrl(String remoteFileName) {
    final base = AppConfig.ftpPublicBaseUrl.replaceAll(RegExp(r'/+$'), '');
    return '$base/$remoteFileName';
  }

  static String _normalizeRemoteDirectory(String directory) {
    var sanitized = directory.trim();
    if (sanitized.isEmpty || sanitized == '.') {
      return '';
    }

    sanitized = sanitized.replaceAll('\\', '/');

    // Strip FTP scheme if present
    sanitized = sanitized.replaceAll(RegExp(r'^ftp://[^/]+'), '');

    // Remove drive letter (e.g. T:/path -> T/path)
    sanitized = sanitized.replaceAllMapped(
      RegExp(r'^([A-Za-z]):/'),
      (match) => '${match.group(1)}/',
    );

    sanitized = sanitized.replaceAll(RegExp(r'^/+'), '');
    sanitized = sanitized.replaceAll(RegExp(r'/+$'), '');

    if (sanitized.isEmpty) {
      return '';
    }

    final segments = sanitized.split('/').where((s) => s.isNotEmpty).toList();
    if (segments.isEmpty) {
      return '';
    }

    segments[0] = segments[0].replaceAll(RegExp(r':$'), '');

    return segments.where((s) => s.isNotEmpty).join('/');
  }

  static Iterable<String> _buildDirectoryCandidates(
    String normalized,
    String original,
  ) {
    final segments = normalized.split('/').where((s) => s.isNotEmpty).toList();
    if (segments.isEmpty) {
      return const [];
    }

    final candidates = <String>{};
    final originalTrimmed = original.trim();
    if (originalTrimmed.isNotEmpty) {
      candidates.add(originalTrimmed);
    }

    final joined = segments.join('/');
    candidates.add('/$joined');
    candidates.add(joined);

    // Special case: if original first segment looked like a drive (e.g. "T")
    if (segments.first.length == 1) {
      final upperDrive = segments.first.toUpperCase();
      final rest = segments.skip(1).join('/');
      if (rest.isEmpty) {
        candidates.add('/$upperDrive');
        candidates.add(upperDrive);
      } else {
        candidates.add('/$upperDrive/$rest');
        candidates.add('$upperDrive/$rest');
      }
    }

    return candidates.where((candidate) => candidate.isNotEmpty);
  }

  static Future<bool> _safeChangeDirectory(
    FTPConnect ftpConnect,
    String target,
  ) async {
    if (target.isEmpty) {
      return false;
    }

    try {
      final changed = await ftpConnect.changeDirectory(target);
      if (!changed) {
        AppLogger.debug('Failed to change directory using "$target"');
      }
      return changed;
    } catch (error) {
      AppLogger.debug('Error changing directory with "$target": $error');
      return false;
    }
  }

  static void _logUploadFailure(String filePath, Object error) {
    AppLogger.error('FTP upload failure: $filePath | $error');
  }
}
