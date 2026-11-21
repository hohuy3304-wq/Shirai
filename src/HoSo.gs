// Mở và cập nhật theo số hợp đồng. Mọi thao tác ghi được gọi dưới khóa script.
function dossierAt_(number) {
  const sheet = sheet_(TAB.contracts),
    map = getHeaderIndexMap_(sheet);
  return rowAt_(sheet, locateContract_(sheet, map, number));
}

function addFields_(ctx, keys) {
  const missing = keys.filter((k) => !ctx.map[k]);
  if (!missing.length) return;
  const s = ctx.sheet,
    first = s.getLastColumn() + 1;
  const extra = first + missing.length - 1 - s.getMaxColumns();
  if (extra > 0) s.insertColumnsAfter(s.getMaxColumns(), extra);
  s.getRange(1, first, 1, missing.length).setValues([missing]);
  missing.forEach((k, i) => {
    ctx.map[k] = first + i;
    ctx.data[k] = '';
  });
}

function mine_(r, email) {
  return [r.Nguoi_Tao, r.Nguoi_Phu_Trach].some(
    (e) =>
      String(e || '')
        .trim()
        .toLowerCase() === email
  );
}

function digest_(value) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)
  );
}

function businessHash_(r) {
  const keys = SCHEMA[TAB.contracts]
    .filter((k) => !['Link_Docs', 'Link_PDF', 'Trang_Thai'].includes(k))
    .concat(['Noi_Dung_HD', 'Uy_Quyen', 'Thay_Doi', 'Ngay_Ra_Soat', 'So_Uy_Quyen', 'Ngay_Uy_Quyen']);
  return digest_(keys.map((k) => (r[k] == null ? '' : r[k])));
}

function revision_(r) {
  return digest_([
    businessHash_(r),
    r.Trang_Thai,
    r.Phien_Trinh,
    r.Link_PDF_Trinh,
    r.Link_PDF,
    r.Link_Docs,
    r.Ly_Do_Tra
  ]);
}
function checkRevision_(row, version) {
  if (version !== revision_(row)) throw new Error('Hồ sơ đã thay đổi. Hãy mở lại từ danh sách.');
}

function draftKey_(token) {
  if (!/^[a-f0-9-]{36}$/i.test(String(token))) throw new Error('Mã phiếu không hợp lệ.');
  return 'nhap/' + token;
}

function readDraft_(form) {
  const raw = PropertiesService.getUserProperties().getProperty(draftKey_(form.token));
  const draft = raw ? JSON.parse(raw) : null;
  if ((draft ? draft.draftVersion : '') !== (form.draftVersion || ''))
    throw new Error('Bản nháp đã thay đổi. Hãy mở lại từ Hợp đồng của tôi.');
  return draft;
}

function luuNhapCaNhan(form) {
  let version;
  runAction_(
    'Lưu nháp cá nhân',
    () => {
      readDraft_(form);
      if (form.number) {
        const r = dossierAt_(form.number).data;
        if (!mine_(r, activeEmail_()) || r.Trang_Thai !== ST.draft) throw new Error('Không thể sửa hồ sơ này.');
        checkRevision_(r, form.version);
      }
      form.draftVersion = Utilities.getUuid();
      const data = JSON.stringify(form);
      if (Utilities.newBlob(data).getBytes().length > 8500)
        throw new Error('Phiếu nháp quá dài. Hãy rút gọn phần diễn giải.');
      PropertiesService.getUserProperties().setProperty(draftKey_(form.token), data);
      version = form.draftVersion;
      return 'Đã lưu bản nháp cá nhân.';
    },
    {}
  );
  return version;
}

function xoaNhapCaNhan(token, draftVersion) {
  return runAction_(
    'Xóa bản nháp cá nhân',
    () => {
      if (!readDraft_({ token, draftVersion })) throw new Error('Bản nháp không còn tồn tại.');
      PropertiesService.getUserProperties().deleteProperty(draftKey_(token));
      return 'Đã xóa bản nháp cá nhân.';
    },
    {}
  );
}

function danhSachHoSo(mode) {
  const email = activeEmail_(),
    review = mode === 'review';
  if (review && !isApprover_(email)) throw new Error('Tài khoản của bạn chưa thuộc NGUOI_DUYET.');
  const local = review
    ? []
    : Object.entries(PropertiesService.getUserProperties().getProperties())
        .filter(([key]) => key.startsWith('nhap/'))
        .map(([, v]) => JSON.parse(v));
  const rows = records_(TAB.contracts).filter(
    (r) => r.So_HD && (review ? r.Trang_Thai === ST.pending : mine_(r, email))
  );
  return {
    drafts: local,
    rows: rows
      .map((r) => {
        const fields = {};
        for (const key of [
          'Loai_HD',
          'Ma_KH',
          'Ngay_Ky',
          'Ngay_Hieu_Luc',
          'Ngay_Het_Han',
          'Ngay_Ra_Soat',
          'Gia_Tri',
          'Nguoi_Phu_Trach',
          'Noi_Dung_HD',
          'Dieu_Khoan_Thanh_Toan',
          'Thay_Doi',
          'Uy_Quyen',
          'So_Uy_Quyen',
          'Ngay_Uy_Quyen',
          'Ghi_Chu'
        ]) {
          fields[key] = validDate_(r[key])
            ? Utilities.formatDate(r[key], TZ, 'yyyy-MM-dd')
            : String(r[key] ?? '');
        }
        return {
          fields,
          number: String(r.So_HD),
          version: revision_(r),
          state: String(r.Trang_Thai),
          name: String(r.Ten_KH),
          reason: String(r.Ly_Do_Tra || ''),
          endedBy: String(r.Can_Cu_Cham_Dut || ''),
          docs: String(r.Link_Docs || ''),
          pdf: String(r.Link_PDF_Trinh || r.Link_PDF || ''),
          edition: Number(r.Phien_Trinh || 0)
        };
      })
      .reverse()
  };
}

function guiPhieuDeDuyet(form) {
  let ctx;
  const email = activeEmail_();
  runAction_(
    'Tạo và gửi duyệt',
    (row) => {
      const r = row.data;
      if (!mine_(r, email)) throw new Error('Hồ sơ thuộc người phụ trách khác.');
      if (r.Yeu_Cau_Trinh === form.token && r.Trang_Thai === ST.pending) return 'Đã gửi duyệt.';
      readDraft_(form);
      if (r.Trang_Thai !== ST.draft) throw new Error('Hồ sơ phải ở trạng thái nháp để gửi duyệt.');
      if (!form.number && Number(r.Phien_Trinh) > 0)
        throw new Error('Phiếu đã được trình. Hãy mở bản hiện tại trong Hợp đồng của tôi.');
      if (r.So_HD) checkFileIdle_(row);
      if (form.number) checkRevision_(r, form.version);
      const fields = formData_({ ...form, Ma_KH: form.Ma_KH || 'KH-' + form.token });
      if (String(r.Loai_HD) !== fields.Loai_HD && r.So_HD)
        throw new Error('Hồ sơ đã có số. Hãy giữ loại hợp đồng ban đầu.');
      const kh = formCustomer_(form, fields.Ma_KH);
      validateBuyer_(fields.Loai_HD, kh);
      addFields_(
        row,
        Object.keys(fields).concat(['Phien_Trinh', 'Link_PDF_Trinh', 'Dau_Trinh', 'Ly_Do_Tra', 'Yeu_Cau_Trinh'])
      );
      Object.entries(fields).forEach(([k, v]) => setField_(row, k, v));
      const job = createContract_(row, true);
      const hash = businessHash_(row.data);
      return () => {
        job();
        return withLock_(() => {
          const current = dossierAt_(row.data.So_HD);
          if (businessHash_(current.data) !== hash || current.data.Trang_Thai !== ST.draft)
            throw new Error('Dữ liệu thay đổi trong lúc xuất. Hãy mở lại hồ sơ và gửi lại.');
          setField_(current, 'Yeu_Cau_Trinh', form.token);
          const msg = chuyenTrangThai_(current.row, ST.pending, current, true);
          PropertiesService.getUserProperties().deleteProperty(draftKey_(form.token));
          return msg;
        });
      };
    },
    {
      context: () => {
        if (!form.number) {
          // Người nhập có thể giao cho đồng nghiệp phụ trách.
          ctx = formRow_(form, email);
        } else ctx = dossierAt_(form.number);
        return ctx;
      }
    }
  );
  return { number: ctx.data.So_HD, docs: ctx.data.Link_Docs, pdf: ctx.data.Link_PDF };
}

function xuLyHoSo(number, version, action, detail) {
  return runAction_(
    'Xử lý hồ sơ',
    (ctx) => {
      const r = ctx.data,
        email = activeEmail_();
      checkRevision_(r, version);
      if (action === 'reviewDate' || action === 'end') {
        if (!isHdnt_(r.Loai_HD) || ![ST.approved, ST.signed].includes(r.Trang_Thai) || !mine_(r, email))
          throw new Error('Chỉ người tạo hoặc phụ trách được cập nhật HĐNT đã duyệt hoặc đã ký.');
        if (action === 'reviewDate') {
          const d = dateFromForm_(detail);
          if (dayNumber_(d) <= dayNumber_(new Date()))
            throw new Error('Chọn ngày rà soát tiếp theo trong tương lai.');
          addFields_(ctx, ['Ngay_Ra_Soat']);
          setField_(ctx, 'Ngay_Ra_Soat', d);
          return 'Đã hẹn rà soát ngày ' + formatDateVi_(d);
        }
        if (!String(detail || '').trim()) throw new Error('Hãy ghi căn cứ chấm dứt.');
        addFields_(ctx, ['Can_Cu_Cham_Dut']);
        setField_(ctx, 'Can_Cu_Cham_Dut', String(detail).trim());
        setField_(ctx, 'Trang_Thai', ST.ended);
        return 'Đã chấm dứt theo xác nhận: ' + detail;
      }
      if (!isApprover_(email) || r.Trang_Thai !== ST.pending)
        throw new Error('Hồ sơ cần ở trạng thái chờ duyệt và tài khoản phải có quyền duyệt.');
      if (action === 'approve') return chuyenTrangThai_(ctx.row, ST.approved, ctx);
      if (action !== 'return' || !String(detail || '').trim()) throw new Error('Hãy ghi lý do trả về.');
      addFields_(ctx, ['Ly_Do_Tra']);
      setField_(ctx, 'Ly_Do_Tra', String(detail).trim());
      return chuyenTrangThai_(ctx.row, ST.draft, ctx) + ' Lý do: ' + detail;
    },
    { context: () => dossierAt_(number) }
  );
}

function thietLapHoSo(link, folder) {
  return runAction_(
    'Thiết lập HĐNT',
    () => {
      const owner = SpreadsheetApp.getActiveSpreadsheet().getOwner();
      if (!owner || owner.getEmail().toLowerCase() !== activeEmail_())
        throw new Error('Chỉ chủ sở hữu bảng tính được đổi thiết lập.');
      const id = requiredId_(link, 'ID_Google_Docs_Mau');
      if (DriveApp.getFileById(id).getMimeType() !== MimeType.GOOGLE_DOCS)
        throw new Error('Hãy chuyển mẫu thành Google Tài liệu trước khi chọn.');
      let root = '';
      if (folder) {
        root = requiredId_(folder, 'ROOT_FOLDER_ID');
        DriveApp.getFolderById(root).getName();
      }
      initSheetStructure();
      const s = sheet_(TAB.templates),
        m = getHeaderIndexMap_(s);
      const types = records_(TAB.templates)
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => isHdnt_(r.Loai_HD));
      if (types.length !== 1)
        throw new Error('Có nhiều loại HĐNT. Hãy cập nhật mẫu trên dòng tương ứng trong tab Mau.');
      s.getRange(types[0].i + 2, m.ID_Google_Docs_Mau).setValue(id);
      if (root) {
        const cfg = sheet_(TAB.config),
          cm = getHeaderIndexMap_(cfg);
        const i = records_(TAB.config).findIndex((r) => r.Key === 'ROOT_FOLDER_ID');
        cfg.getRange(i + 2, cm.Value).setValue(root);
      }
      return 'Đã lưu thiết lập HĐNT.';
    },
    {}
  );
}
