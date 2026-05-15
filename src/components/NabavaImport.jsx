import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase.js';
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { VASCO_COLUMN_MAP, formatEUR } from '../nabavaConfig.js';

// Pretvori Excel datum (število) v ISO date string
function excelDateToISO(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    return `${date.y}-${m}-${d}`;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function toStr(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

export default function NabavaImport({ user, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      alert('Prosim izberi Excel datoteko (.xlsx ali .xls)');
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);
    setParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const targetSheet = wb.SheetNames.find(n => n.includes('Pregled nabave')) || wb.SheetNames[0];
      const ws = wb.Sheets[targetSheet];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        if (rawData[i] && rawData[i][0] === 'Datum') {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        throw new Error('Ne najdem stolpca "Datum" v prvih 5 vrsticah.');
      }

      const headers = rawData[headerRowIdx];
      const dataRows = rawData.slice(headerRowIdx + 1).filter(r => r && r[0] != null);

      const rows = [];
      const errors = [];
      let totalValue = 0;
      let minDate = null;
      let maxDate = null;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const obj = {};

        headers.forEach((header, idx) => {
          const dbField = VASCO_COLUMN_MAP[header];
          if (!dbField) return;
          let val = row[idx];

          if (dbField === 'datum') {
            val = excelDateToISO(val);
          } else if (['nabava', 'nabava_vred', 'nab_vred_odv', 'zadnja_nc', 'zadnja_vnesena_nc', 'info_nc'].includes(dbField)) {
            val = toNum(val);
          } else {
            val = toStr(val);
          }

          obj[dbField] = val;
        });

        if (!obj.datum) {
          errors.push(`Vrstica ${i + headerRowIdx + 2}: manjka datum`);
          continue;
        }
        if (!obj.dobavitelj) {
          errors.push(`Vrstica ${i + headerRowIdx + 2}: manjka dobavitelj`);
          continue;
        }

        rows.push(obj);

        if (obj.nab_vred_odv) totalValue += obj.nab_vred_odv;
        if (!minDate || obj.datum < minDate) minDate = obj.datum;
        if (!maxDate || obj.datum > maxDate) maxDate = obj.datum;
      }

      setPreview({
        rows,
        errors,
        stats: { total: rows.length, totalValue, minDate, maxDate, sheet: targetSheet }
      });
    } catch (err) {
      console.error('Parse error:', err);
      alert(`Napaka pri branju Excela: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) return;
    setImporting(true);

    try {
      const { data: importRec, error: impErr } = await supabase
        .from('purchase_imports')
        .insert({
          filename: file.name,
          uploaded_by: user.email,
          rows_count: preview.rows.length,
          rows_inserted: 0,
          date_from: preview.stats.minDate,
          date_to: preview.stats.maxDate,
          total_value: preview.stats.totalValue
        })
        .select()
        .single();

      if (impErr) throw impErr;

      const batchSize = 500;
      let inserted = 0;
      const allRows = preview.rows.map(r => ({
        ...r,
        import_id: importRec.id,
        created_by: user.email
      }));

      for (let i = 0; i < allRows.length; i += batchSize) {
        const batch = allRows.slice(i, i + batchSize);
        const { error: insErr } = await supabase.from('purchases').insert(batch);
        if (insErr) throw insErr;
        inserted += batch.length;
      }

      await supabase
        .from('purchase_imports')
        .update({ rows_inserted: inserted })
        .eq('id', importRec.id);

      setImportResult({ success: true, inserted, importId: importRec.id });

      if (onImported) onImported();
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({ success: false, error: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: 'white', borderRadius: 12, maxWidth: 700,
        width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Uvozi VASCO Excel - Nabava</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? '#C8102E' : '#ccc'}`,
              borderRadius: 8, padding: 40, textAlign: 'center',
              background: dragActive ? '#fff5f5' : '#fafafa', cursor: 'pointer'
            }}
            onClick={() => document.getElementById('nabava-file-input').click()}
          >
            <Upload size={40} style={{ color: '#888', marginBottom: 12 }} />
            <p style={{ margin: '8px 0', fontSize: 15, fontWeight: 500 }}>
              Klikni ali povleci VASCO Excel datoteko
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              .xlsx ali .xls (sheet "01-Pregled nabave v EUR")
            </p>
            <input id="nabava-file-input" type="file" accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
          </div>
        )}

        {file && parsing && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#C8102E' }} />
            <p style={{ marginTop: 12 }}>Berem datoteko...</p>
          </div>
        )}

        {preview && !importResult && (
          <div>
            <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#666' }}>Datoteka:</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#666' }}>Sheet:</span>
                <span style={{ fontSize: 13 }}>{preview.stats.sheet}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#666' }}>Število vrstic:</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{preview.stats.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#666' }}>Obdobje:</span>
                <span style={{ fontSize: 13 }}>{preview.stats.minDate} → {preview.stats.maxDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#666' }}>Skupna vrednost:</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatEUR(preview.stats.totalValue)}</span>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <AlertCircle size={16} style={{ color: '#856404' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#856404' }}>
                    {preview.errors.length} vrstic preskočenih
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 24, fontSize: 12, color: '#856404' }}>
                  {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {preview.errors.length > 5 && <li>... in {preview.errors.length - 5} več</li>}
                </ul>
              </div>
            )}

            <div style={{ background: '#e7f3ff', border: '1px solid #b8daff', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#004085' }}>
              ℹ️ Vsi podatki bodo dodani v bazo. Dvojniki niso blokirani.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={importing}
                style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                Prekliči
              </button>
              <button onClick={handleImport} disabled={importing || preview.rows.length === 0}
                style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#C8102E', color: 'white', cursor: importing ? 'wait' : 'pointer', fontWeight: 500 }}>
                {importing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Uvažam...
                  </span>
                ) : (
                  `Uvozi ${preview.rows.length} vrstic`
                )}
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            {importResult.success ? (
              <>
                <CheckCircle size={48} style={{ color: '#28a745', marginBottom: 12 }} />
                <h3 style={{ margin: '8px 0' }}>Uvoz uspešen!</h3>
                <p style={{ color: '#666', fontSize: 14 }}>Uvoženih {importResult.inserted} vrstic</p>
                <button onClick={onClose}
                  style={{ marginTop: 16, padding: '10px 24px', borderRadius: 6, border: 'none', background: '#C8102E', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                  Zapri
                </button>
              </>
            ) : (
              <>
                <AlertCircle size={48} style={{ color: '#dc3545', marginBottom: 12 }} />
                <h3 style={{ margin: '8px 0' }}>Napaka pri uvozu</h3>
                <p style={{ color: '#dc3545', fontSize: 13, fontFamily: 'monospace', textAlign: 'left' }}>
                  {importResult.error}
                </p>
                <button onClick={onClose}
                  style={{ marginTop: 16, padding: '10px 24px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                  Zapri
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
