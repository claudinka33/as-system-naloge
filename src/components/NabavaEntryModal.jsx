import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import { X, Save, Calculator } from 'lucide-react';

const AS_RED = '#C8102E';

export default function NabavaEntryModal({ user, entry, onClose, onSaved }) {
  const isEdit = !!entry?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // obvezna polja
  const [datum, setDatum] = useState(entry?.datum || new Date().toISOString().slice(0, 10));
  const [dobavitelj, setDobavitelj] = useState(entry?.dobavitelj || '');
  const [naziv, setNaziv] = useState(entry?.naziv || '');
  const [nabava, setNabava] = useState(entry?.nabava ?? '');
  const [nabVredOdv, setNabVredOdv] = useState(entry?.nab_vred_odv ?? '');

  // opcijska polja
  const [sifra, setSifra] = useState(entry?.sifra || '');
  const [enota, setEnota] = useState(entry?.enota || 'kos');
  const [zadnjaNc, setZadnjaNc] = useState(entry?.zadnja_nc ?? '');
  const [nazSkupine, setNazSkupine] = useState(entry?.naz_skupine || '');
  const [nazivNadskupine, setNazivNadskupine] = useState(entry?.naziv_nadskupine || '');

  // ali je uporabnik ročno spreminjal vrednost (da auto-calc ne overrida)
  const [vrednostManual, setVrednostManual] = useState(isEdit);

  // auto-calc: vrednost = količina × NC (samo če vrednost ni ročno spremenjena)
  useEffect(() => {
    if (vrednostManual) return;
    const q = parseFloat(nabava);
    const nc = parseFloat(zadnjaNc);
    if (!isNaN(q) && !isNaN(nc)) {
      setNabVredOdv((q * nc).toFixed(2));
    }
  }, [nabava, zadnjaNc, vrednostManual]);

  function handleVrednostChange(e) {
    setNabVredOdv(e.target.value);
    setVrednostManual(true);
  }

  function resetAutoCalc() {
    setVrednostManual(false);
  }

  async function handleSave() {
    setError(null);

    // validacija obveznih polj
    if (!datum) return setError('Datum je obvezen');
    if (!dobavitelj.trim()) return setError('Dobavitelj je obvezen');
    if (!naziv.trim()) return setError('Naziv je obvezen');
    if (nabava === '' || isNaN(parseFloat(nabava))) return setError('Količina je obvezna in mora biti število');
    if (nabVredOdv === '' || isNaN(parseFloat(nabVredOdv))) return setError('Vrednost je obvezna in mora biti število');

    setSaving(true);
    const payload = {
      datum,
      dobavitelj: dobavitelj.trim(),
      naziv: naziv.trim(),
      nabava: parseFloat(nabava),
      nab_vred_odv: parseFloat(nabVredOdv),
      sifra: sifra.trim() || null,
      enota: enota.trim() || null,
      zadnja_nc: zadnjaNc !== '' ? parseFloat(zadnjaNc) : null,
      naz_skupine: nazSkupine.trim() || null,
      naziv_nadskupine: nazivNadskupine.trim() || null,
      source: 'manual',
      created_by_email: user?.email || null,
      created_by_name: user?.user_metadata?.full_name || user?.email || null,
      updated_at: new Date().toISOString()
    };

    let res;
    if (isEdit) {
      res = await supabase.from('purchases').update(payload).eq('id', entry.id);
    } else {
      payload.created_at = new Date().toISOString();
      res = await supabase.from('purchases').insert(payload);
    }

    setSaving(false);
    if (res.error) {
      setError('Napaka pri shranjevanju: ' + res.error.message);
      return;
    }
    onSaved?.();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{isEdit ? 'Uredi vnos nabave' : 'Nov vnos nabave'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Datum *" >
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} style={input()} />
            </Field>
            <Field label="Dobavitelj *" >
              <input type="text" value={dobavitelj} onChange={(e) => setDobavitelj(e.target.value)} placeholder="npr. INOX TRADE d.o.o." style={input()} />
            </Field>
          </div>

          <Field label="Naziv artikla *" style={{ marginTop: 12 }}>
            <input type="text" value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="npr. Vijak M8x40" style={input()} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Količina *" >
              <input type="number" step="any" value={nabava} onChange={(e) => setNabava(e.target.value)} placeholder="0" style={input()} />
            </Field>
            <Field label="Enota" >
              <input type="text" value={enota} onChange={(e) => setEnota(e.target.value)} placeholder="kos" style={input()} />
            </Field>
            <Field label="Nabavna cena (EUR/enoto)" >
              <input type="number" step="any" value={zadnjaNc} onChange={(e) => setZadnjaNc(e.target.value)} placeholder="0.00" style={input()} />
            </Field>
          </div>

          <Field label={`Vrednost (EUR) *${vrednostManual ? '' : ' (auto)'}`} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" step="any" value={nabVredOdv} onChange={handleVrednostChange} placeholder="0.00" style={{ ...input(), flex: 1 }} />
              {vrednostManual && (
                <button type="button" onClick={resetAutoCalc} title="Ponovno izračunaj iz količina × NC"
                  style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, background: '#f8f8f8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calculator size={14} /> Auto
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              {vrednostManual ? 'Ročno vneseno. Klikni Auto za izračun iz količina × NC.' : 'Avtomatsko izračunano iz količina × NC.'}
            </div>
          </Field>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #eee' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Opcijska polja</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Šifra artikla" >
                <input type="text" value={sifra} onChange={(e) => setSifra(e.target.value)} placeholder="npr. 0001234" style={{ ...input(), fontFamily: 'monospace' }} />
              </Field>
              <Field label="Skupina" >
                <input type="text" value={nazSkupine} onChange={(e) => setNazSkupine(e.target.value)} placeholder="npr. Vijaki" style={input()} />
              </Field>
            </div>
            <Field label="Nadskupina" style={{ marginTop: 12 }}>
              <input type="text" value={nazivNadskupine} onChange={(e) => setNazivNadskupine(e.target.value)} placeholder="npr. Pritrdilni elementi" style={input()} />
            </Field>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: 10, background: '#fee', border: '1px solid #fcc', borderRadius: 6, color: '#c33', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'white' }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 14 }}>
            Prekliči
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: AS_RED, color: 'white', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {saving ? 'Shranjujem...' : (isEdit ? 'Shrani spremembe' : 'Shrani vnos')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function input() {
  return { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
}
