'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authUtils, User } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import mammoth from 'mammoth';

interface InspectionAnswer {
  id: string;
  inspectionId: string;
  answers: any;
  answeredBy: string;
  answeredAt: string;
  inspection: {
    id: string;
    title: string;
    device?: {
      serialNumber: string;
      assetTag: string;
      model?: {
        manufacturer: string;
        model: string;
      };
      site?: {
        name: string;
        organization?: {
          name: string;
          code: string;
        };
      };
      organization?: {
        name: string;
        code: string;
      };
    };
    assignee?: {
      fullName: string;
      organization?: {
        name: string;
      };
    };
  };
  user?: {
    fullName: string;
    organization?: {
      name: string;
    };
  };
}

export default function TemplateViewerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [availableAnswers, setAvailableAnswers] = useState<InspectionAnswer[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string>('');
  const [answerData, setAnswerData] = useState<any>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initializePage = async () => {
      // Check if user is authenticated
      if (!authUtils.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Get user data
      const currentUser = authUtils.getUser();
      if (currentUser) {
        setUser(currentUser);
      }

      // Check if answerId is provided in URL query params
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlAnswerId = urlParams.get('answerId');
        const embedded = urlParams.get('embedded') === 'true';
        setIsEmbedded(embedded);
        if (urlAnswerId) {
          setSelectedAnswerId(urlAnswerId);
        }
      }

      // Load available inspection answers
      await loadAvailableAnswers();
    };

    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAnswerId) {
      loadTemplateWithData(selectedAnswerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnswerId]);

  const loadAvailableAnswers = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.inspectionAnswers.getAll({ page: 1, limit: 100 });
      const answers = response.data || response || [];
      setAvailableAnswers(answers);
      
      // Check if answerId is in URL params
      let urlAnswerId: string | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        urlAnswerId = urlParams.get('answerId');
      }
      
      // Auto-select from URL or first answer if available
      if (urlAnswerId && answers.some((a: InspectionAnswer) => String(a.id) === urlAnswerId)) {
        // URL parameter answer exists in the list
        setSelectedAnswerId(urlAnswerId);
      } else if (answers.length > 0 && !selectedAnswerId && !urlAnswerId) {
        // No URL param, auto-select first answer
        setSelectedAnswerId(String(answers[0].id));
      }
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to load inspection answers:', err);
      setError('Үзлэгийн хариултуудыг ачаалахад алдаа гарлаа');
      setIsLoading(false);
    }
  };

  // Helper function to get nested value from object using dot notation
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  };

  // Helper function to replace Carbone placeholders in HTML
  const replacePlaceholders = (html: string, dataMap: any): string => {
    let processedHtml = html;
    
    // Replace Carbone-style placeholders: {d.field.subfield} or {data.field} or {field}
    // Supports nested paths like {d.data.exterior.platform.status}
    // Also handles spaces like {d. metadata.field}
    const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_\.\s]*[a-zA-Z0-9_]+)\}/g;
    
    processedHtml = processedHtml.replace(placeholderPattern, (match, placeholder) => {
      // Remove spaces and normalize the placeholder
      const normalizedPlaceholder = placeholder.replace(/\s+/g, '');
      
      // Handle different Carbone formats
      // {d.field} -> looks in d.field, then data.field
      // {data.field} -> looks in data.field
      // {field} -> looks in data.field, then root.field
      
      let value = undefined;
      
      if (normalizedPlaceholder.startsWith('d.')) {
        // Carbone format: {d.xxx} or {d. metadata.inspector}
        const pathWithoutD = normalizedPlaceholder.substring(2); // Remove 'd.' prefix
        
        // Try multiple path variations for metadata support
        const paths = [
          normalizedPlaceholder,              // d.metadata.inspector (full path)
          `metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // metadata.inspector
          `data.${pathWithoutD}`,  // data.metadata.inspector
          pathWithoutD,            // metadata.inspector (direct)
          `d.data.${pathWithoutD.replace(/^data\./, '')}`, // if starts with data., remove duplicate
          `d.metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // d.metadata.inspector (explicit)
          `data.metadata.${pathWithoutD.replace(/^metadata\./, '')}`, // data.metadata.inspector
          // For metadata fields directly accessed
          pathWithoutD.replace(/^metadata\./, ''), // inspector (if at root)
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) {
            console.log(`Found value for ${normalizedPlaceholder} at path: ${path}`, value);
            break;
          }
        }
        
        if (value === undefined || value === null) {
          console.log(`Could not find value for ${normalizedPlaceholder}, tried paths:`, paths);
        }
      } else if (normalizedPlaceholder.startsWith('data.')) {
        // Direct data path: {data.xxx}
        const paths = [
          normalizedPlaceholder, // data.date
          normalizedPlaceholder.replace('data.', 'metadata.'), // metadata.date (alternative)
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      } else if (normalizedPlaceholder.startsWith('metadata.')) {
        // Direct metadata path: {metadata.date}
        const metadataField = normalizedPlaceholder.replace('metadata.', '');
        const paths = [
          normalizedPlaceholder, // metadata.date
          normalizedPlaceholder.replace('metadata.', 'data.'), // data.date (if merged)
          metadataField, // date (if at root level)
          `data.${normalizedPlaceholder}`, // data.metadata.date
          `d.data.${normalizedPlaceholder}`, // d.data.metadata.date
          `d.metadata.${metadataField}`, // d.metadata.date
          `metadata.${metadataField}`, // metadata.date (alternative)
        ];
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) {
            console.log(`Found metadata value for ${normalizedPlaceholder} at path: ${path}`, value);
            break;
          }
        }
      } else {
        // Simple field: {field} - could be metadata field like {date}
        const paths = [
          `data.${normalizedPlaceholder}`, // data.date (metadata merged into data)
          `metadata.${normalizedPlaceholder}`, // metadata.date
          normalizedPlaceholder, // date (at root level)
          `d.data.${normalizedPlaceholder}`, // d.data.date
          `d.metadata.${normalizedPlaceholder}`, // d.metadata.date
        ];
        
        for (const path of paths) {
          value = getNestedValue(dataMap, path);
          if (value !== undefined && value !== null) break;
        }
      }
      
      // Format the value
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value !== null) {
          // For objects, try to extract meaningful values
          if (value.status !== undefined) {
            return String(value.status);
          }
          if (value.comment !== undefined) {
            return String(value.comment);
          }
          if (value.answer !== undefined) {
            return String(value.answer);
          }
          // Otherwise stringify
          return JSON.stringify(value);
        }
        return String(value);
      }
      
      // If not found, return empty string instead of placeholder (so it doesn't clutter)
      return '';
    });
    
    return processedHtml;
  };

  const loadTemplateWithData = async (answerId: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      // Get inspection answer with data
      const answerResponse = await apiService.inspectionAnswers.getById(answerId);
      const answer = answerResponse.data || answerResponse;
      const answerJson = answer?.answers || answer?.data || {};
      
      // Debug: Check where metadata is located
      console.log('Answer JSON structure:', {
        hasMetadata: !!answerJson.metadata,
        hasDataMetadata: !!answerJson.data?.metadata,
        rootKeys: Object.keys(answerJson),
        dataKeys: answerJson.data ? Object.keys(answerJson.data) : null
      });
      
      // Extract metadata (can be at root level or inside data)
      const metadata = answerJson.metadata || answerJson.data?.metadata || {};
      
      console.log('Extracted metadata:', {
        metadata,
        metadataKeys: Object.keys(metadata),
        inspector: metadata.inspector,
        location: metadata.location,
        date: metadata.date
      });
      
      // Build comprehensive data map for placeholder replacement
      const inspection = answer?.inspection || {};
      const device = inspection?.device || {};
      const site = device?.site || {};
      const organization = site?.organization || device?.organization || {};
      const assignee = inspection?.assignee || {};
      const user = answer?.user || {};
      
      // Get the actual data object (nested or direct)
      const actualData = answerJson.data || answerJson;
      
      // Merge metadata fields directly into data object for easy access
      // This allows {d.data.date} to work when date is in metadata
      const dataWithMetadata = { ...actualData };
      if (metadata && Object.keys(metadata).length > 0) {
        // Merge metadata fields into data object
        Object.assign(dataWithMetadata, metadata);
        // Also keep metadata as nested object
        dataWithMetadata.metadata = metadata;
      }
      
      // Create data map compatible with Carbone format
      const dataMap = {
        // Direct answers data
        ...answerJson,
        data: dataWithMetadata,
        
        // Include metadata at multiple levels for flexibility
        metadata: metadata,
        
        // Add metadata fields directly to root level for {metadata.field} access
        ...(metadata && Object.keys(metadata).length > 0 ? metadata : {}),
        
        // Inspection data
        inspection: {
          id: inspection?.id?.toString() || '',
          title: inspection?.title || '',
          type: inspection?.type || '',
          status: inspection?.status || '',
        },
        
        // Device data
        device: {
          serialNumber: device?.serialNumber || '',
          assetTag: device?.assetTag || '',
          model: device?.model ? {
            manufacturer: device.model.manufacturer || '',
            model: device.model.model || ''
          } : null,
        },
        
        // Contractor/Organization data (Carbone style)
        contractor: {
          company: organization?.name || '',
          code: organization?.code || '',
        },
        
        organization: {
          name: organization?.name || '',
          code: organization?.code || '',
        },
        
        site: {
          name: site?.name || '',
        },
        
        // User data
        user: {
          fullName: user?.fullName || '',
          organization: user?.organization ? {
            name: user.organization.name || '',
            code: user.organization.code || ''
          } : null,
        },
        
        assignee: {
          fullName: assignee?.fullName || '',
          organization: assignee?.organization ? {
            name: assignee.organization.name || '',
            code: assignee.organization.code || ''
          } : null,
        },
        
        // Legacy Carbone paths for backward compatibility
        d: {
          contractor: {
            company: organization?.name || '',
          },
          device: {
            serialNumber: device?.serialNumber || '',
            assetTag: device?.assetTag || '',
          },
          data: dataWithMetadata, // Already includes metadata fields
          metadata: metadata, // Nested metadata object
        },
      };
      
      // Debug: Log dataMap structure to help identify metadata
      console.log('DataMap structure:', {
        hasMetadata: !!metadata,
        metadataKeys: metadata ? Object.keys(metadata) : [],
        metadataValues: metadata ? metadata : null,
        dataKeys: Object.keys(dataWithMetadata),
        metadataSample: metadata ? Object.entries(metadata).slice(0, 5) : null,
        dMetadata: dataMap.d?.metadata,
        dMetadataKeys: dataMap.d?.metadata ? Object.keys(dataMap.d.metadata) : []
      });
      
      setAnswerData(dataMap);
      
      // Fetch the .docx file from backend
      const arrayBuffer = await apiService.documents.getTemplate('auto_scale_inspection_template_fin.docx');
      
      // Convert .docx to HTML using mammoth
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1.title:fresh",
            "p[style-name='Heading 1'] => h1.heading1:fresh",
            "p[style-name='Heading 2'] => h2.heading2:fresh",
            "p[style-name='Heading 3'] => h3.heading3:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          includeDefaultStyleMap: true,
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          }),
        }
      );
      
      // Replace placeholders with actual data
      const populatedHtml = replacePlaceholders(result.value, dataMap);
      setHtmlContent(populatedHtml);
      
      // Log any warnings
      if (result.messages.length > 0) {
        console.warn('Conversion warnings:', result.messages);
      }
    } catch (err: any) {
      console.error('Failed to load template:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Баримт файл ачаалахад алдаа гарлаа';
      setError(errorMessage);
      setHtmlContent(''); // Clear content on error
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplate = async () => {
    if (selectedAnswerId) {
      await loadTemplateWithData(selectedAnswerId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Hide when embedded */}
      {!isEmbedded && <Sidebar currentUser={user} />}

      {/* Main Content */}
      <div className={`flex-1 ${!isEmbedded ? 'ml-64' : ''}`}>
        {/* Header - Hide when embedded */}
        {!isEmbedded && (
          <header className="bg-white shadow-sm">
            <div className="px-6 py-4 flex justify-between items-center">
              <div>
                <button
                  onClick={() => router.back()}
                  className="text-indigo-600 hover:text-indigo-800 mb-2 text-sm font-medium"
                >
                  ← Буцах
                </button>
                <h1 className="text-xl font-bold text-gray-900">Үзлэгийн Загвар Баримт</h1>
                <p className="text-sm text-gray-500">Auto Scale Inspection Template</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedAnswerId}
                  onChange={(e) => setSelectedAnswerId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Үзлэгийн хариулт сонгох --</option>
                  {availableAnswers.map((answer) => (
                    <option key={answer.id} value={answer.id}>
                      ID: {answer.id} - {answer.inspection?.title || 'Байхгүй'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadTemplate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  🔄 Шинэчлэх
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  🖨️ Хэвлэх
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        <main className={isEmbedded ? "p-0" : "p-6"}>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">{error}</div>
              <button 
                onClick={loadTemplate}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Дахин ачаалах
              </button>
            </div>
          )}

          {/* Document Content */}
          {htmlContent && (
            <div className="bg-gray-100 p-8 flex justify-center">
              <div 
                className="document-preview bg-white shadow-2xl"
                style={{
                  width: '8.5in',
                  minHeight: '11in',
                  padding: '1in',
                  fontFamily: '"Times New Roman", "Times", serif',
                  fontSize: '12pt',
                  lineHeight: '1.15',
                  color: '#000000',
                }}
              >
                <div 
                  className="document-content"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  style={{
                    fontFamily: '"Times New Roman", "Times", serif',
                    fontSize: '12pt',
                    lineHeight: '1.15',
                    color: '#000000',
                  }}
                />
              </div>
            </div>
          )}

          {!htmlContent && !error && (
            <div className="text-center py-12">
              <p className="text-gray-500">Баримт ачаалах боломжгүй байна</p>
            </div>
          )}
        </main>
      </div>

      {/* Custom Styles for Word-like appearance */}
      <style jsx global>{`
        .document-preview {
          /* Word default page settings */
        }
        
        .document-content {
          /* Reset browser defaults */
          margin: 0;
          padding: 0;
        }
        
        .document-content p {
          margin: 6pt 0;
          text-align: left;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
          line-height: 1.15;
        }
        
        .document-content h1,
        .document-content h2,
        .document-content h3,
        .document-content h4,
        .document-content h5,
        .document-content h6 {
          font-family: "Times New Roman", "Times", serif;
          font-weight: bold;
          margin: 12pt 0 6pt 0;
          page-break-after: avoid;
        }
        
        .document-content h1 {
          font-size: 16pt;
        }
        
        .document-content h2 {
          font-size: 14pt;
        }
        
        .document-content h3 {
          font-size: 13pt;
        }
        
        .document-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 12pt 0;
          border: 1pt solid #000000;
        }
        
        .document-content table td,
        .document-content table th {
          border: 1pt solid #000000;
          padding: 4pt 6pt;
          vertical-align: top;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
        }
        
        .document-content table th {
          font-weight: bold;
          background-color: #f0f0f0;
        }
        
        .document-content ul,
        .document-content ol {
          margin: 6pt 0;
          padding-left: 0.5in;
        }
        
        .document-content li {
          margin: 3pt 0;
          font-family: "Times New Roman", "Times", serif;
          font-size: 12pt;
        }
        
        .document-content img {
          max-width: 100%;
          height: auto;
          margin: 6pt 0;
        }
        
        .document-content strong,
        .document-content b {
          font-weight: bold;
        }
        
        .document-content em,
        .document-content i {
          font-style: italic;
        }
        
        .document-content u {
          text-decoration: underline;
        }
        
        /* Print styles */
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .document-preview {
            width: 100%;
            min-height: 100vh;
            padding: 0;
            margin: 0;
            box-shadow: none;
            background: white;
          }
          
          header,
          .bg-gray-50,
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

