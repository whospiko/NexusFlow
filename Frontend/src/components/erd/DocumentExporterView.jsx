import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import {
  FileText,
  Download,
  Eye,
  CheckSquare,
  Square,
  Palette,
  Image as ImageIcon,
  Check,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Settings2,
  RefreshCw,
  Printer,
} from 'lucide-react';

const THEME_COLORS = [
  { label: 'Corporate Blue', value: '#0c66e4', bg: 'bg-[#0c66e4]' },
  { label: 'Royal Purple', value: '#7c3aed', bg: 'bg-[#7c3aed]' },
  { label: 'Emerald Green', value: '#059669', bg: 'bg-[#059669]' },
  { label: 'Amber Orange', value: '#ea580c', bg: 'bg-[#ea580c]' },
  { label: 'Slate Dark', value: '#334155', bg: 'bg-[#334155]' },
];

export function DocumentExporterView({ projectId }) {
  // Document Configuration Options
  const [docOptions, setDocOptions] = useState({
    title: 'Database Design & Relational Modeling Specification',
    author: 'Software Architecture & Engineering Team',
    logoUrl: '',
    themeColor: '#0c66e4',
    sections: {
      s1: true, // Introduction & Methodology
      s2: true, // Entity Sets
      s3: true, // Attribute Tables (Image 2/3 format)
      s4: true, // Relationships (Image 4 format)
      s5: true, // ER Diagram
      s6: true, // Table Schema (Image 7 format)
      s7: true, // De-normalization Summary
    },
  });

  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'preview'
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState(null); // 'pdf' | 'docx' | 'md'
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Toggle Section
  const handleToggleSection = (secKey) => {
    setDocOptions((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [secKey]: !prev.sections[secKey],
      },
    }));
  };

  // Select/Deselect All Sections
  const handleSelectAllSections = (enable) => {
    setDocOptions((prev) => ({
      ...prev,
      sections: {
        s1: enable,
        s2: enable,
        s3: enable,
        s4: enable,
        s5: enable,
        s6: enable,
        s7: enable,
      },
    }));
  };

  // Fetch Live HTML Preview
  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setErrorMsg('');
      const res = await api.exportErdHtml(projectId, docOptions);
      setPreviewHtml(res.data?.html || '<p>No preview generated</p>');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate live preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'preview') {
      loadPreview();
    }
  }, [activeTab, docOptions]);

  // Browser Native Direct Print / Save to PDF
  const handleBrowserPrint = async () => {
    try {
      setExporting(true);
      setExportType('print');
      setErrorMsg('');
      setStatusMsg('Generating clean print document...');

      const res = await api.exportErdHtml(projectId, docOptions);
      const html = res.data?.html;
      if (!html) throw new Error('No document content returned');

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Pop-up window was blocked by the browser. Please allow popups for localhost.');
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 600);

      setStatusMsg('Print dialog ready! Select "Save as PDF" to save.');
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Direct print failed');
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  // Export Document Handlers
  const handleExport = async (format) => {
    try {
      setExporting(true);
      setExportType(format);
      setErrorMsg('');
      setStatusMsg(`Generating ${format.toUpperCase()} document...`);

      if (format === 'pdf') {
        try {
          await api.exportErdPdf(projectId, docOptions, `database-design-p${projectId}.pdf`);
        } catch (pdfErr) {
          console.warn('Server PDF export failed, falling back to direct browser print:', pdfErr);
          // Auto fallback to browser native print
          await handleBrowserPrint();
          return;
        }
      } else if (format === 'docx') {
        await api.exportErdDocx(projectId, docOptions, `database-design-p${projectId}.docx`);
      } else if (format === 'md') {
        await api.exportErdMarkdown(projectId, docOptions, `database-design-p${projectId}.md`);
      }

      setStatusMsg(`${format.toUpperCase()} export downloaded successfully!`);
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 7: PDF / Word Document Exporter
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Core Value ⭐
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Export comprehensive, publication-grade Database Specifications matching source document structure in PDF, DOCX (Word), or Markdown.
            </p>
          </div>
        </div>

        {/* Tab & Format Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141923] p-1 rounded-lg border border-[#2e374f]">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-[#0c66e4] text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              <Settings2 size={13} />
              <span>Configure Sections</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              <Eye size={13} />
              <span>Live HTML Preview</span>
            </button>
          </div>

          {/* Direct One-Click Export Buttons */}
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
            title="Download formatted A4 PDF via Server"
          >
            <Download size={13} />
            <span>{exporting && exportType === 'pdf' ? 'Rendering PDF...' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={handleBrowserPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
            title="Direct Browser Print / Save to PDF (Zero Wait)"
          >
            <Printer size={13} />
            <span>{exporting && exportType === 'print' ? 'Opening Print...' : 'Print / Save PDF'}</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('docx')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
            title="Download Word DOCX file"
          >
            <Download size={13} />
            <span>{exporting && exportType === 'docx' ? 'Building DOCX...' : 'Export Word (DOCX)'}</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('md')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-[#dfe1e6] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            title="Download Markdown with Mermaid ERD"
          >
            <FileCode size={13} />
            <span>Markdown</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check size={14} />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'config' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Branding & Cover Page Customization */}
          <div className="bg-[#141923] border border-[#22273b] rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2 pb-2 border-b border-[#22273b]">
              <Palette size={15} className="text-sky-400" />
              <span>Cover Page & Enterprise Branding</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={docOptions.title}
                  onChange={(e) => setDocOptions({ ...docOptions, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#10141e] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Author / Engineering Team
                </label>
                <input
                  type="text"
                  value={docOptions.author}
                  onChange={(e) => setDocOptions({ ...docOptions, author: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#10141e] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Company / Organization Logo (URL or Image Link)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={docOptions.logoUrl}
                  onChange={(e) => setDocOptions({ ...docOptions, logoUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#10141e] border border-[#2e374f] text-[#dfe1e6] focus:outline-none focus:border-[#579dff]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#8c9bab] mb-1">
                  Brand Theme Color Accent
                </label>
                <div className="flex items-center gap-2 mt-1">
                  {THEME_COLORS.map((tc) => (
                    <button
                      key={tc.value}
                      type="button"
                      onClick={() => setDocOptions({ ...docOptions, themeColor: tc.value })}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${tc.bg} ${
                        docOptions.themeColor === tc.value
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141923] scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={tc.label}
                    >
                      {docOptions.themeColor === tc.value && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                  <span className="text-[11px] font-mono text-[#8c9bab] ml-2">
                    {docOptions.themeColor}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Configurable Document Sections Checkboxes */}
          <div className="bg-[#141923] border border-[#22273b] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#22273b]">
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <CheckSquare size={15} className="text-purple-400" />
                <span>Document Sections Selection</span>
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectAllSections(true)}
                  className="text-sky-400 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-[#626f86]">•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllSections(false)}
                  className="text-[#8c9bab] hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* S1 */}
              <label
                onClick={() => handleToggleSection('s1')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s1}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 1: Introduction & Methodology</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    System scope, conceptual modeling, and Codd relational methodology.
                  </div>
                </div>
              </label>

              {/* S2 */}
              <label
                onClick={() => handleToggleSection('s2')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s2}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 2: Entity Sets</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    Complete list of Strong and Weak entities with identifying parents.
                  </div>
                </div>
              </label>

              {/* S3 */}
              <label
                onClick={() => handleToggleSection('s3')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s3}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 3: Attribute Tables (Image 2/3 Format)</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    Column breakdown per entity: Attribute | PK/FK | DataType | Nullable | Desc.
                  </div>
                </div>
              </label>

              {/* S4 */}
              <label
                onClick={() => handleToggleSection('s4')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s4}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 4: Relationships & Logic (Image 4 Format)</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    [A] relates to [B], cardinality, cascade rules, and (a)/(b) descriptions.
                  </div>
                </div>
              </label>

              {/* S5 */}
              <label
                onClick={() => handleToggleSection('s5')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s5}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 5: Visual ER Diagram</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    Visual schema diagram rendered directly from the React Flow canvas.
                  </div>
                </div>
              </label>

              {/* S6 */}
              <label
                onClick={() => handleToggleSection('s6')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s6}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 6: Table Schema (Image 7 Format)</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    Normalized 3NF relational tables with primary and foreign key mapping.
                  </div>
                </div>
              </label>

              {/* S7 */}
              <label
                onClick={() => handleToggleSection('s7')}
                className="p-3 rounded-lg border bg-[#10141e] border-[#242b3d] hover:border-[#3b4764] flex items-start gap-3 cursor-pointer transition-colors md:col-span-2"
              >
                <input
                  type="checkbox"
                  checked={docOptions.sections.s7}
                  readOnly
                  className="mt-0.5 w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <div>
                  <div className="font-bold text-[#dfe1e6]">Section 7: De-normalization Summary & Analysis</div>
                  <div className="text-[11px] text-[#8c9bab]">
                    Flattened parent-child tables absorbing parent descriptive columns for high-throughput reads.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      ) : (
        /* LIVE HTML PREVIEW TAB */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#525659]">
          <div className="px-5 py-2 bg-[#333639] border-b border-[#222426] flex items-center justify-between text-xs text-white shrink-0">
            <span className="font-semibold text-slate-200">A4 Document Layout Preview</span>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow-xs cursor-pointer"
            >
              <Printer size={13} />
              <span>Print / Save as PDF</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-white text-xs mt-20">
                <RefreshCw size={16} className="animate-spin" />
                <span>Generating real-time print preview...</span>
              </div>
            ) : (
              <div className="w-full max-w-[850px] bg-white text-black shadow-2xl rounded-sm overflow-hidden min-h-[1000px] p-10">
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="preview-content"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="px-5 py-2.5 border-t border-[#22273b] bg-[#161b26] flex items-center justify-between text-xs text-[#8c9bab]">
        <span>
          Matching structure of <strong>Step 2: System Analysis</strong> source specification
        </span>
        <span className="font-mono text-[11px] text-emerald-400">
          Server-side Puppeteer PDF & Native Microsoft Word DOCX
        </span>
      </div>
    </div>
  );
}

