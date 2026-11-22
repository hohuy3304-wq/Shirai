# Web App quản lý hợp đồng Hồng Thiên

Nhân viên mở đường dẫn web app để lập và theo dõi hồ sơ. Google Sheets lưu khách hàng, bản nháp, hợp đồng và nhật ký. Google Docs lưu mẫu và bản đã duyệt. Menu **Hợp đồng** trong Sheet vẫn mở được cùng giao diện.

Sau khi thiết lập lần đầu, mở link `/exec` để vào **Quản lý hợp đồng**. Tìm theo số hợp đồng, khách hàng hoặc mã số thuế, lọc theo trạng thái, chọn **Chi tiết và lịch sử** để xem quá trình xử lý. Bấm **+ Tạo hợp đồng** để lập phiếu. Trong **Khách hàng**, bạn có thể thêm, tìm, cập nhật thông tin hoặc lập hợp đồng ngay cho khách đã chọn.

## Đưa bản mới vào Sheet đang dùng

1. Trên Windows, tải ZIP từ **Code → Download ZIP** của GitHub, chọn **Giải nén tất cả** và mở **Cap-nhat.cmd** trong thư mục có `package.json`. Tệp dùng Node.js 22 trở lên, tự cài clasp và mở đăng nhập Google khi cần. Kiểm tra đúng dự án được gợi ý hoặc dán URL trình chỉnh sửa Apps Script của Sheet. Sau khi đồng bộ, công cụ đọc lại mã trên Google trong một thư mục tạm và thông báo kết quả. Với môi trường đã cấu hình clasp, bạn cũng có thể dùng `npx clasp -P .clasp.local.json push`.
2. Trong Apps Script, mở **Triển khai → Quản lý bản triển khai → Chỉnh sửa → Phiên bản mới → Triển khai** để cập nhật link `/exec` hiện tại. Với lần triển khai đầu tiên, chọn **Ứng dụng web**, chạy bằng **Người dùng truy cập ứng dụng**, chọn phạm vi người dùng phù hợp và sao chép link `/exec`.
3. Mở link bằng tài khoản Google đã chạy trình cập nhật. Trong **Thiết lập sổ**, chọn **Dùng Google Sheet hiện có** và dán link sổ Hồng Thiên, hoặc chọn **Tạo sổ Google Sheets mới**. Kiểm tra thư mục Drive rồi xác nhận. Nhân viên mở cùng link sau khi quản trị viên hoàn tất bước này. Với sổ đã kết nối, app mở thẳng giao diện làm việc. Nếu triển khai thủ công bằng clasp, người quản trị cấu hình Script Property `SETUP_ADMIN_EMAIL` bằng email quản trị được ủy quyền trước khi triển khai.
4. Trong **Thiết lập** của app, đăng ký mẫu Google Docs theo loại, thông tin pháp nhân bên bán và email người duyệt. Mẫu Word cần được lưu dưới dạng Google Tài liệu. Nhân viên nhập khách và hợp đồng trên app, chọn **Xem sổ dữ liệu** khi cần đối chiếu các dòng đã lưu.
5. Chia sẻ quyền sửa Sheet cho nhóm nội bộ, quyền đọc và sao chép mẫu, quyền ghi thư mục lưu hợp đồng cho người lập và người duyệt. Mỗi nhân viên mở link bằng tài khoản được chia sẻ và cấp quyền Google lần đầu. Ứng dụng dùng Drive API v3 trong manifest. Nếu dùng dự án Google Cloud tiêu chuẩn tự quản lý, bật Google Drive API trong dự án đó.

Sau khi kết nối, hợp đồng mới lưu tại **Thư mục gốc / Năm / Khách hàng**. Mỗi lần trình giữ Docs và PDF riêng. Lúc phê duyệt, app kiểm tra phiên bản cả hai tệp, tạo Google Docs chính thức trong **Đã duyệt** bên dưới thư mục khách hàng và ghi người duyệt, thời điểm, liên kết vào Sheet. Drive khóa nội dung bản Docs đã duyệt ở chế độ chỉ đọc. Chủ sở hữu tệp có thể quản lý khóa. Tệp cũ tiếp tục mở ở vị trí đã lưu. Hồ sơ đang chờ duyệt từ bản cũ cần trả về và trình lại một lần để có thông tin phiên bản Drive.

## Kiểm tra web app với hai tài khoản

Trên Sheet và thư mục thử, tài khoản A lưu nháp, mở lại và gửi một HĐNT. Tài khoản B trong danh sách người duyệt xem PDF, trả về kèm lý do rồi duyệt lần trình thứ hai. Trong **Hợp đồng đã duyệt**, cả hai tài khoản kiểm tra số hợp đồng, link Docs đã duyệt và người duyệt. Đối chiếu với **HopDong**, thư mục **Đã duyệt** và hai đường dẫn PDF trong **NhatKy**.

## Một vòng lập và duyệt HĐNT

| Người dùng | Thao tác |
| --- | --- |
| Người lập | Trên web app chọn **Tạo hợp đồng**. Tìm bên mua theo tên, mã hoặc MST. Có thể thêm khách hàng ngay trên phiếu. Kiểm tra tên pháp nhân, MST, địa chỉ, người đại diện và chức vụ. |
| Người lập | Điền ngày ký và người phụ trách. Ngày ký cũng là ngày hiệu lực. Nếu ký theo ủy quyền, điền số và ngày giấy ủy quyền. Điền ngày rà soát nếu muốn nhận nhắc. Giá trị tổng có thể để trống khi đơn giá theo từng đơn hàng. |
| Người lập | Mở **Thay đổi so với mẫu** nếu hai bên có thỏa thuận riêng. **Lưu nháp** giữ cả phiếu nhập dở theo tài khoản. Mở lại hoặc xóa trong **Quản lý hợp đồng**. Dữ liệu phiếu được lưu vào tab **BanNhap**. |
| Người lập | **Tạo và gửi duyệt** cấp số, lưu Docs và PDF, chuyển sang **Chờ duyệt**. Nếu bị trả về, mở **Quản lý hợp đồng → Sửa và trình duyệt**, sửa theo lý do rồi gửi lại. Số hợp đồng giữ nguyên và mỗi lần trình có PDF riêng. |
| Người duyệt | Mở **Chờ tôi duyệt**, xem PDF của lần trình, bấm **Phê duyệt** hoặc **Trả về** và ghi lý do. Mỗi lần trình ghi số phiên bản và liên kết PDF vào **NhatKy**. Nếu hồ sơ thay đổi trong khi đang mở, tải lại danh sách trước khi thao tác. |
| Người phụ trách hoặc người lập | Với HĐNT đã duyệt hoặc đã ký, mở **Quản lý hợp đồng** để hẹn ngày rà soát mới hoặc ghi căn cứ chấm dứt. HĐNT tự gia hạn theo mẫu. Đến mốc rà soát, hệ thống nhắc theo lịch đã cài và giữ trạng thái hiện tại. |

**HopDong** là sổ chung của nhóm. Trang **Quản lý hợp đồng** hiển thị hồ sơ do bạn tạo hoặc phụ trách, hồ sơ bạn đã duyệt và các hồ sơ đang chờ nếu bạn có quyền duyệt. Người có quyền sửa Sheet có thể mở sổ chung và bound script. Danh sách nháp lọc theo email người lập. Người có quyền truy cập Sheet có thể xem tab **BanNhap**. Bản nháp từ phiên bản cũ vẫn mở được bằng tài khoản đã tạo và được chuyển vào Sheet khi lưu lại.

## Cài vào Google Workspace

1. Chủ sở hữu tạo **một Google Sheet mới trên My Drive** và mở **Tiện ích mở rộng → Apps Script** từ chính Sheet đó. Trong **Cài đặt dự án**, sao chép **ID tập lệnh**. ID này khác ID của Sheet, mẫu Docs và thư mục Drive.
2. Bật Google Apps Script API trong phần cài đặt người dùng Apps Script của tài khoản dùng để đồng bộ. Nếu tổ chức quản lý quyền OAuth, tài khoản cần được phép sử dụng clasp và các dịch vụ ở bước 5. [Cài đặt Apps Script](https://script.google.com/home/usersettings)
3. Dùng Node.js 22 trở lên. Tại thư mục gốc của kho mã, chạy các lệnh sau. Lệnh đăng nhập mở luồng OAuth của Google. Giữ thông tin đăng nhập clasp trong hồ sơ người dùng.

   ```sh
   npm ci
   npm test
   npx clasp login
   cp .clasp.json .clasp.local.json
   ```

4. Điền ID tập lệnh thật vào trường `scriptId` của **.clasp.local.json**. Giữ `"rootDir": "src"`. clasp v3 đọc tệp cấu hình từ thư mục hiện hành. Thư mục gốc chứa cấu hình và thư mục `src/` chứa manifest, các tệp `.gs` và giao diện `BanLamViec.html`. Bản cấu hình cục bộ đã được Git bỏ qua. Kiểm tra đúng dự án và danh sách tệp trước khi đẩy lên dự án mới. Khi clasp hỏi cập nhật manifest, kiểm tra ID đích rồi xác nhận.

   ```sh
   npx clasp -P .clasp.local.json show-file-status
   npx clasp -P .clasp.local.json push
   ```

5. Tải lại trình soạn thảo Apps Script, chọn **initSheetStructure** và bấm **Chạy** bằng tài khoản chủ sở hữu. Xem và cấp các quyền cho Google Sheets để mở sổ theo ID khi chạy qua web, Docs, Drive, gửi mail, nhận diện email, quản lý trigger và hiển thị hộp thoại liên kết thư mục. Mẫu và thư mục do tổ chức cung cấp cần cho phép tài khoản thực thi truy cập. Hàm khởi tạo dùng múi giờ **Asia/Ho_Chi_Minh**, tạo sáu tab, tiêu đề, danh mục ban đầu, dropdown, định dạng và công thức tên khách hàng. Có thể chạy lại sau khi thêm hàng để bổ sung công thức vào các ô tên còn trống.
6. Chạy **runAllTests** trong trình soạn thảo. Nhật ký thực thi liệt kê năm nhóm kiểm thử. Tải lại Sheet để thấy menu **Hợp đồng**. Mỗi người thao tác nên dùng một Chrome Profile chỉ đăng nhập tài khoản Workspace của công ty để xác định đúng email khi duyệt.

## Điền dữ liệu trước hợp đồng đầu tiên

| Tab | Dữ liệu cần chuẩn bị |
| --- | --- |
| KhachHang | Mỗi khách hàng một `Ma_KH` duy nhất. Nhập tên công ty, địa chỉ, MST, người đại diện, chức vụ, điện thoại, email và tài khoản ngân hàng. Các cột mã, thuế, điện thoại và tài khoản dùng văn bản để giữ số 0 đầu. |
| Mau | Mỗi `Loai_HD` một dòng. Thay `<DIEN_ID_DOC_MAU>` bằng ID Google Docs thật, nhập tiền tố như `HDDV` hoặc `HDNT`. Trước khi kết nối web app, `Thu_Muc_Luu_ID` có thể chỉ định thư mục riêng. Sau khi kết nối, các hợp đồng mới dùng thư mục gốc chung. |
| CauHinh | Điền các khóa bên bán, `NGUOI_DUYET`, `EMAIL_NHAN_NHAC` và `SO_NGAY_NHAC` (mặc định `30,15,7`). Danh sách dùng dấu phẩy. Thay `<DIEN_ID_THU_MUC_GOC>` bằng ID thư mục khi dùng cách lưu theo năm và tên khách hàng. |
| HopDong | Với loại có thời hạn, nhập loại, mã khách, ngày hiệu lực, ngày hết hạn và giá trị VND. Ngày hết hạn phải sau ngày hiệu lực. Có thể nhập ngày ký, điều khoản thanh toán, email người phụ trách và ghi chú. Chừa các trường cấp số, thời điểm tạo và liên kết cho script. |
| BanNhap | Bản nháp theo email người lập và mã phiếu, gồm cả thông tin đang nhập dở. |
| NhatKy | Mỗi thao tác menu và mỗi lần quét ghi thời điểm, email, hành động, số hợp đồng nếu có và kết quả hoặc lỗi. |

ID của mẫu nằm giữa `/document/d/` và `/edit` trên URL. ID thư mục nằm sau `/folders/`. Người tạo hợp đồng cần quyền đọc/sao chép mẫu và quyền tạo tệp ở thư mục đích. Người nhận email cần quyền đọc tệp qua Drive để mở liên kết. Phiên bản này dùng My Drive.

Trước khi chia sẻ Sheet, chủ sở hữu vào **Dữ liệu → Bảo vệ trang tính và dải ô**, giới hạn quyền sửa **CauHinh** và **Mau** cho quản trị viên. Danh sách người duyệt và nơi lưu tài liệu nằm ở hai tab này. Người dùng cần quyền ghi **NhatKy** để thao tác qua menu. Vì người có quyền sửa Sheet cũng có thể sửa bound script, quy trình phù hợp với nhóm nội bộ tin cậy.

## Soạn mẫu Docs

Đặt nguyên khóa viết hoa trong hai cặp ngoặc nhọn, cùng một đoạn văn và cùng định dạng. Có thể đặt khóa vào bảng, đầu trang, chân trang hoặc tab con. Tắt **Different first page header/footer** trên biểu mẫu. Đầu trang riêng của trang đầu cần hỗ trợ nâng cao ngoài DocumentApp.

| Nội dung | Khóa mẫu |
| --- | --- |
| Hợp đồng | `{{SO_HD}}`, `{{LOAI_HD}}`, `{{NGAY_KY}}`, `{{NGAY_HIEU_LUC}}`, `{{NGAY_HET_HAN}}`, `{{GIA_TRI}}`, `{{GIA_TRI_BANG_CHU}}`, `{{DIEU_KHOAN_THANH_TOAN}}`, `{{NGUOI_PHU_TRACH}}`, `{{TRANG_THAI}}`, `{{GHI_CHU}}` |
| Khách hàng | `{{MA_KH}}`, `{{TEN_KH}}`, `{{DIA_CHI_KH}}`, `{{MST_KH}}`, `{{DAI_DIEN_KH}}`, `{{CHUC_VU_KH}}`, `{{SDT_KH}}`, `{{EMAIL_KH}}`, `{{TAI_KHOAN_NH_KH}}`. Các tên cột gốc của KhachHang viết hoa cũng dùng được. |
| Bên bán | `{{TEN_BEN_BAN}}`, `{{MST_BEN_BAN}}`, `{{DIA_CHI_BEN_BAN}}`, `{{DAI_DIEN_BEN_BAN}}`, `{{CHUC_VU_BEN_BAN}}`, `{{SDT_BEN_BAN}}`, `{{TAI_KHOAN_BEN_BAN}}` |
| HĐNT | `{{UY_QUYEN_KH}}` đặt dưới đại diện bên mua, `{{THAY_DOI}}` đặt tại vị trí ghi thỏa thuận riêng. Nếu phiếu có nội dung ở hai mục này, ứng dụng kiểm tra khóa tương ứng trước khi xuất. `{{NGAY_RA_SOAT}}` dùng khi cần in ngày rà soát. |
| Mẫu cũ | `{{DIEU_KHOAN_TT}}` cùng lấy giá trị điều khoản thanh toán. |

Tiền được làm tròn đến đồng. Ví dụ, 15.500.000 cho kết quả “Mười lăm triệu năm trăm nghìn đồng”. Ngày được điền theo định dạng ngày/tháng/năm. Chủ mẫu cần kiểm tra chính tả của khóa trong bản PDF nghiệm thu.

## Tạo, duyệt và xuất lại

1. Chọn một ô trên dòng dữ liệu của **HopDong**. Bấm **Hợp đồng → Thao tác trên dòng → Tạo hợp đồng từ dòng đang chọn**. Với thư mục mặc định, đường dẫn lưu là `ROOT_FOLDER_ID / năm cấp số / tên khách hàng`. Tên Docs và PDF gồm số hợp đồng và tên khách.
2. Mở **Link_Docs** và **Link_PDF** để kiểm tra nội dung. Số có dạng `HDDV-2026-0001`. Một khóa chung bảo vệ bước cấp số, bộ đếm lưu theo tiền tố và năm. Số đã cấp có thể bị khuyết khi gặp lỗi. Khi thử lại, giữ nguyên số trên dòng. Nếu đã ghi link Docs, ứng dụng có thể tiếp tục xuất PDF. Sau lần chạy bị dừng ở giữa, khóa xuất của riêng hợp đồng tự hết hạn sau bảy phút.
3. **Tạo lại PDF** xuất phiên bản hiện tại của bản Docs đã liên kết và cập nhật **Link_PDF**. Bản PDF trước vẫn nằm trong Drive. Nếu dữ liệu thương mại thay đổi trong lúc còn nháp, cập nhật và đối chiếu cả bản Docs trước khi xuất lại và trình duyệt. Khi lập số mới, dùng dòng mới và để trống số cùng các cột theo dõi.
4. Gửi qua phiếu và duyệt tại **Chờ tôi duyệt**. Sau khi ký, chọn dòng trong **HopDong** rồi bấm **Hợp đồng → Thao tác trên dòng → Đánh dấu đã ký**. Có thể trả về nháp từ Chờ duyệt, hoặc hủy từ Nháp, Chờ duyệt, Đã duyệt. Chỉ email thuộc **NGUOI_DUYET** được duyệt, đánh dấu đã ký hoặc hủy một hợp đồng đã duyệt. Khi duyệt, script khóa các cột nội dung của dòng và giữ quyền cho chủ sở hữu cùng người duyệt. Các cột trạng thái, liên kết và ghi chú là cột vận hành. Chuyển trạng thái qua menu để chạy kiểm tra quyền, tạo vùng khóa và ghi nhật ký. Sửa tay dropdown sẽ bỏ qua các bước đó. Quyền sửa bản Docs và PDF được quản lý riêng trên Drive.
5. **Mở thư mục lưu** hiển thị liên kết thư mục của hợp đồng. Nếu thao tác báo lỗi, xem **NhatKy** cùng quyền trên mẫu, thư mục và dải ô tương ứng.

## Cài lịch nhắc

Chủ sở hữu chọn **Hợp đồng → Cài nhắc hạn hàng ngày** hoặc chạy **installDailyTrigger** trong Apps Script. Mục **Triggers** sẽ có một lịch theo ngày cho **runDailyContractScan**, trong khung 8–9 giờ Việt Nam. Cài lại bằng cùng tài khoản sẽ dùng lại lịch chung. Khi đổi chủ sở hữu, chủ cũ xóa lịch của mình trước khi chủ mới cài lại.

Bộ quét chỉ xét hợp đồng **Đã duyệt** hoặc **Đã ký**. Với hợp đồng có thời hạn, qua ngày hết hạn, trạng thái chuyển thành **Hết hạn**. Với HĐNT, hệ thống nhắc vào ngày rà soát và các mốc cấu hình trước đó. Dòng HĐNT cũ dùng ngày hết hạn làm mốc nhắc đến khi có ngày rà soát riêng. Đúng ngày khớp một mốc nhắc, hệ thống gom các hợp đồng vào một email HTML kèm liên kết, gửi tới danh sách đã cấu hình. Múi giờ của Sheet và script phải cùng là giờ Việt Nam. Nút **Quét hết hạn** chạy cùng nghiệp vụ ngay lập tức, kể cả bước gửi email. Lịch và menu dùng chung dấu ghi nhận ngày gửi thành công. Nếu thiếu hạn mức, các trạng thái quá hạn vẫn được cập nhật và người vận hành có thể quét lại trong ngày khi đủ hạn mức.

## Nghiệm thu trên Sheet thử

Dùng bản sao mẫu và thư mục thử, hai tài khoản Workspace cùng hộp thư thử của tổ chức.

| Thao tác | Kết quả cần quan sát |
| --- | --- |
| Tạo một hợp đồng hợp lệ, bấm giờ từ menu tới khi có liên kết | Có Docs và PDF đúng thư mục trong mục tiêu dưới 30 giây. Mở PDF để đối chiếu bố cục, bảng, tab con, đầu/chân trang và số tiền bằng chữ với mẫu. Ghi riêng lần cấp quyền OAuth đầu tiên. |
| Hai người tạo trên hai dòng cùng tiền tố và năm | Hai số khác nhau. Bấm lại trên cùng dòng giữ nguyên số và liên kết tới bản Docs đầu tiên. |
| Bỏ trống loại, sai mã khách, nhập số tiền âm hoặc ngày hết hạn bằng ngày hiệu lực | Có thông báo lỗi và dòng nhật ký, chưa tạo tệp. |
| Hai người lần lượt thử duyệt bằng menu | Người ngoài danh sách nhận lỗi. Người duyệt được chấp nhận và nhân viên không thể sửa các ô nội dung đã khóa. |
| Đặt hợp đồng đã ký hết hạn hôm qua và hai hợp đồng khác còn 7, 15 ngày, quét hai lần | Hợp đồng đầu chuyển Hết hạn. Hộp thư thử nhận một email chứa cả hai hợp đồng còn lại. |
| Xem NhatKy sau mỗi thao tác | Có người thao tác, thời điểm, số thích hợp và kết quả. |

`npm test` chạy các kiểm thử dùng chung với Apps Script và mô phỏng các dịch vụ Google để kiểm tra cạnh tranh cấp số, phục hồi sau lỗi, bảo vệ cột, xử lý mẫu và email. Thời gian đáp ứng, quyền thực tế và bố cục PDF cần đo bằng mẫu và tài khoản của tổ chức.
