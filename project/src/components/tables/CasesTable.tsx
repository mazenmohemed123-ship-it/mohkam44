import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, X, Check, Lock, AlertTriangle, Users, Archive, Phone } from 'lucide-react';
import { Button, Modal } from '../atoms';
import { useRole } from '../../context/RoleContext';
import { isCaseCreationBlocked, TIER_CASE_LIMITS } from '../../services/caseQuotas';

interface Column {
  key: string;
  label: string;
  type: string;
}

interface Row {
  id: string;
  [key: string]: any;
}

interface CasesTableProps {
  cases: Row[];
  columns: Column[];
  onUpdate: (id: string, patch: Record<string, any>) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onAddCol: (name: string) => void;
  onDelCol: (key: string) => void;
  onRowClick: (row: Row) => void;
  selectedId?: string;
  onArchive: (id: string) => void;
  onDeleteCase: (id: string) => void;
}

export function CasesTable({
  cases,
  columns,
  onUpdate,
  onAdd,
  onDelete,
  onAddCol,
  onDelCol,
  onRowClick,
  selectedId,
  onArchive,
  onDeleteCase,
}: CasesTableProps) {
  const { tier, profile } = useRole();
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [addColName, setAddColName] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [followersTarget, setFollowersTarget] = useState<Row | null>(null);
  const [followerInput, setFollowerInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const cellRef = useRef<HTMLInputElement>(null);

  const officeLink = (row: Row) => `${window.location.origin}/portal/lawyer/${row.lawyer_id}`;

  const addFollowerPhone = () => {
    if (!followersTarget) return;
    const phone = followerInput.trim();
    if (!phone) return;
    const current: string[] = followersTarget.follower_phones || [];
    if (current.includes(phone) || phone === followersTarget.client_phone) { setFollowerInput(''); return; }
    if (current.length >= 10) return;
    const next = [...current, phone];
    onUpdate(followersTarget.id, { follower_phones: next });
    setFollowersTarget({ ...followersTarget, follower_phones: next });
    setFollowerInput('');
  };

  const removeFollowerPhone = (phone: string) => {
    if (!followersTarget) return;
    const next = (followersTarget.follower_phones || []).filter((p: string) => p !== phone);
    onUpdate(followersTarget.id, { follower_phones: next });
    setFollowersTarget({ ...followersTarget, follower_phones: next });
  };

  useEffect(() => {
    if (editingCell && cellRef.current) cellRef.current.focus();
  }, [editingCell]);

  const isFreeTierLocked = isCaseCreationBlocked(tier, cases.length);

  const startEdit = (rowId: string, colKey: string, value: any) => {
    setEditingCell({ rowId, colKey });
    setEditValue(String(value ?? ''));
  };

  const finishEdit = () => {
    if (editingCell) {
      const patch: Record<string, any> = {};
      const col = columns.find((c) => c.key === editingCell.colKey);
      let val: any = editValue;
      if (col?.type === 'number') val = parseFloat(editValue) || 0;
      patch[editingCell.colKey] = val;
      onUpdate(editingCell.rowId, patch);
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleAddCol = () => {
    if (addColName.trim()) {
      onAddCol(addColName.trim());
      setAddColName('');
      setShowAddCol(false);
    }
  };

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', background: '#fff' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}></th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onMouseEnter={() => setHoveredCol(col.key)}
                  onMouseLeave={() => setHoveredCol(null)}
                  style={{ position: 'relative' }}
                >
                  {col.label}
                  {hoveredCol === col.key && col.key !== 'case_number' && col.key !== 'client_name' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelCol(col.key); }}
                      style={{
                        position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                        background: 'var(--danger)', border: 'none', borderRadius: 4,
                        width: 18, height: 18, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#fff',
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </th>
              ))}
              <th style={{ width: 140 }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                style={{
                  background: selectedId === row.id ? '#F5F8FF' : undefined,
                  cursor: 'pointer',
                }}
              >
                <td style={{ textAlign: 'center' }}>
                  {selectedId === row.id && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--navy)', display: 'inline-block' }} />
                  )}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(row.id, col.key, row[col.key]); }}
                    style={{ position: 'relative' }}
                  >
                    {editingCell?.rowId === row.id && editingCell?.colKey === col.key ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          ref={cellRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={finishEdit}
                          type={col.type === 'number' ? 'number' : 'text'}
                          style={{
                            width: '100%', padding: '4px 8px', border: '1.5px solid var(--navy-mid)',
                            borderRadius: 6, fontSize: 12, fontFamily: "'Cairo',sans-serif",
                            outline: 'none',
                          }}
                        />
                        <button onClick={finishEdit} style={{ background: 'var(--success)', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                          <Check size={12} color="#fff" />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: col.type === 'number' ? "'JetBrains Mono', monospace" : undefined }}>
                        {col.type === 'number' && row[col.key] != null
                          ? Number(row[col.key]).toLocaleString()
                          : row[col.key] || '—'}
                      </span>
                    )}
                  </td>
                ))}
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFollowersTarget(row); setFollowerInput(''); setLinkCopied(false); }}
                      title="متابعو القضية ورابط المكتب"
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--navy)' }}
                    >
                      <Users size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchive(row.id); }}
                      title="أرشفة"
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--muted)' }}
                    >
                      <Archive size={13} />
                    </button>
                    {(profile?.tier === 'pro' || profile?.tier === 'team') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteCase(row.id); }}
                        title="حذف نهائي"
                        style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.4)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Button
          size="sm"
          onClick={onAdd}
          disabled={isFreeTierLocked}
          style={{ opacity: isFreeTierLocked ? 0.5 : 1 }}
        >
          {isFreeTierLocked ? <Lock size={12} /> : <Plus size={12} />}
          {isFreeTierLocked ? ' وصلت للحد الأقصى' : ' إضافة صف جديد'}
        </Button>

        {!showAddCol ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAddCol(true)}>
            <Plus size={12} /> عمود جديد
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={addColName}
              onChange={(e) => setAddColName(e.target.value)}
              placeholder="اسم العمود"
              style={{
                padding: '4px 10px', border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 12, fontFamily: "'Cairo',sans-serif",
                outline: 'none', width: 140,
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCol(); if (e.key === 'Escape') { setShowAddCol(false); setAddColName(''); } }}
            />
            <Button size="sm" onClick={handleAddCol}>إضافة</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAddCol(false); setAddColName(''); }}>
              <X size={12} />
            </Button>
          </div>
        )}
      </div>

      {isFreeTierLocked && (
        <div style={{ padding: '8px 14px', background: '#FFFBEB', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={12} color="var(--gold)" />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            باقتك محدودة بـ {TIER_CASE_LIMITS[tier] === Infinity ? '∞' : TIER_CASE_LIMITS[tier]} قضية. <strong style={{ color: 'var(--navy)', cursor: 'pointer' }}>قم بالترقية</strong> لإضافة المزيد.
          </span>
        </div>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FDECEF', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={28} color="var(--danger)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)', marginBottom: 10 }}>حذف القضية نهائياً</h3>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, marginBottom: 6 }}>
              سيتم حذف قضية <strong>{deleteTarget.case_number}</strong> لـ <strong>{deleteTarget.client_name || 'بدون اسم'}</strong>
            </p>
            <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 20 }}>
              سيتم حذف جميع الرسائل والمستندات والمواعيد المرتبطة نهائياً
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="danger" fullWidth onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}>
                <Trash2 size={14} /> حذف نهائي
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            </div>
          </div>
        </Modal>
      )}

      {followersTarget && (
        <Modal onClose={() => setFollowersTarget(null)}>
          <div style={{ padding: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} /> متابعو القضية
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              أضف حتى 10 أرقام هاتف للموكلين المسموح لهم بمتابعة هذه القضية. لن يتمكن أحد من الدخول إلا إذا كان رقمه مسجّلاً هنا أو كرقم الموكل الأساسي.
            </p>

            {/* Office link */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>رابط المكتب (أرسله للموكل)</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: 10, background: '#fff', padding: '8px 10px', borderRadius: 6, color: 'var(--navy)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>{officeLink(followersTarget)}</code>
                <Button size="sm" variant="gold" onClick={() => { navigator.clipboard?.writeText(officeLink(followersTarget)); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }}>
                  {linkCopied ? <Check size={12} /> : 'نسخ'}
                </Button>
              </div>
            </div>

            {/* Primary client phone */}
            {followersTarget.client_phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F5F8FF', borderRadius: 8, marginBottom: 8 }}>
                <Phone size={13} color="var(--navy)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: "'JetBrains Mono', monospace" }}>{followersTarget.client_phone}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 'auto' }}>الموكل الأساسي</span>
              </div>
            )}

            {/* Follower phones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {(followersTarget.follower_phones || []).map((p: string) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <Phone size={13} color="var(--muted)" />
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{p}</span>
                  <button onClick={() => removeFollowerPhone(p)} style={{ marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><X size={14} /></button>
                </div>
              ))}
            </div>

            {(followersTarget.follower_phones?.length || 0) < 10 ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={followerInput}
                  onChange={(e) => setFollowerInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addFollowerPhone(); }}
                  placeholder="+20 1X XXXX XXXX"
                  dir="ltr"
                  style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'JetBrains Mono', monospace" }}
                />
                <Button onClick={addFollowerPhone}><Plus size={14} /> إضافة</Button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>وصلت للحد الأقصى (10 أرقام)</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
