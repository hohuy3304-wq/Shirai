# Shirai · Quản lý hợp đồng trên Google Sheets

Người phụ trách nhập một dòng hợp đồng trên Google Sheets. Menu **Hợp đồng** cấp số, điền mẫu Google Docs, xuất PDF và ghi hai liên kết vào dòng đó. Người duyệt chốt nội dung trên Sheet. Chủ sở hữu cài lịch tổng hợp các hợp đồng sắp hết hạn qua email.

## Nhập hợp đồng trên một phiếu

1. Sau khi đồng bộ mã, tải lại Sheet. Chủ sở hữu chọn **Hợp đồng → Chuẩn bị mẫu và thư mục** khi cần tạo cấu hình còn thiếu. Lệnh dùng lại cấu hình đã điền, tạo mẫu tham khảo cho loại chưa có mẫu và dùng thư mục **Quản lý hợp đồng Hồng Thiên** trên My Drive khi cần. Có thể dán nguyên link Docs và link thư mục Google Drive vào các ô cấu hình. Điền thông tin pháp nhân Hồng Thiên ở tab **CauHinh** một lần và chia sẻ quyền đọc mẫu, ghi thư mục cho người lập.
2. Chọn **Hợp đồng → Nhập hợp đồng mới…** ở bất kỳ tab nào. Chọn loại và khách hàng, hoặc chọn **Thêm khách hàng mới…**. Điền nội dung, các ngày, giá trị VND, điều khoản thanh toán, người phụ trách và ghi chú. Email phụ trách và hai ngày đầu được điền gợi ý, có thể sửa trước khi tạo.
3. Bấm **Tạo hợp đồng và PDF**. Khi thành công, phiếu hiển thị số hợp đồng và hai liên kết. Dòng được lưu trong **HopDong**. Khi xuất lỗi sau bước lưu, dùng **Thử xuất lại** trên cùng phiếu hoặc tiếp tục từ dòng đã lưu. Phiếu bổ sung hai cột ở cuối bảng khi dùng lần đầu: `Noi_Dung_HD` chứa công việc/hàng hóa, `Ma_Phieu` nhận diện lần nhập để tránh tạo trùng khi gửi lại.
4. Với mẫu Docs riêng đã dùng trước đây, đặt **`{{NOI_DUNG_HD}}`** tại phần mô tả công việc để đưa nội dung mới vào bản xuất. Mẫu tham khảo do chức năng chuẩn bị tạo đã có sẵn khóa này.

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

4. Điền ID tập lệnh thật vào trường `scriptId` của **.clasp.local.json**. Giữ `"rootDir": "src"`. clasp v3 đọc tệp cấu hình từ thư mục hiện hành. Thư mục gốc chứa cấu hình và thư mục `src/` chứa manifest, các tệp `.gs` và giao diện `Phieu.html`. Bản cấu hình cục bộ đã được Git bỏ qua. Kiểm tra đúng dự án và danh sách tệp trước khi đẩy lên dự án mới. Khi clasp hỏi cập nhật manifest, kiểm tra ID đích rồi xác nhận.

   ```sh
   npx clasp -P .clasp.local.json show-file-status
   npx clasp -P .clasp.local.json push
   ```

5. Tải lại trình soạn thảo Apps Script, chọn **initSheetStructure** và bấm **Chạy** bằng tài khoản chủ sở hữu. Xem và cấp các quyền cho bảng tính hiện hành, Docs, Drive, gửi mail, nhận diện email, quản lý trigger và hiển thị hộp thoại liên kết thư mục. Mẫu và thư mục do tổ chức cung cấp cần cho phép tài khoản thực thi truy cập. Hàm khởi tạo dùng múi giờ **Asia/Ho_Chi_Minh**, tạo năm tab, tiêu đề, danh mục ban đầu, dropdown, định dạng và công thức tên khách hàng. Có thể chạy lại sau khi thêm hàng để bổ sung công thức vào các ô tên còn trống.
6. Chạy **runAllTests** trong trình soạn thảo. Nhật ký thực thi liệt kê năm nhóm kiểm thử. Tải lại Sheet để thấy menu **Hợp đồng**. Mỗi người thao tác nên dùng một Chrome Profile chỉ đăng nhập tài khoản Workspace của công ty để xác định đúng email khi duyệt.

## Điền dữ liệu trước hợp đồng đầu tiên

| Tab | Dữ liệu cần chuẩn bị |
| --- | --- |
| KhachHang | Mỗi khách hàng một `Ma_KH` duy nhất. Nhập tên công ty, địa chỉ, MST, người đại diện, chức vụ, điện thoại, email và tài khoản ngân hàng. Các cột mã, thuế, điện thoại và tài khoản dùng văn bản để giữ số 0 đầu. |
| Mau | Mỗi `Loai_HD` một dòng. Thay `<DIEN_ID_DOC_MAU>` bằng ID Google Docs thật, nhập tiền tố như `HDDV`. Có thể thêm loại mua bán và nguyên tắc. Nếu điền `Thu_Muc_Luu_ID`, ứng dụng lưu trực tiếp vào thư mục đó. |
| CauHinh | Điền các khóa bên bán, `NGUOI_DUYET`, `EMAIL_NHAN_NHAC` và `SO_NGAY_NHAC` (mặc định `30,15,7`). Danh sách dùng dấu phẩy. Thay `<DIEN_ID_THU_MUC_GOC>` bằng ID thư mục khi dùng cách lưu theo năm và tên khách hàng. |
| HopDong | Nhập loại, mã khách, ngày hiệu lực, ngày hết hạn và giá trị VND. Ngày hết hạn phải sau ngày hiệu lực. Có thể nhập ngày ký, điều khoản thanh toán, email người phụ trách và ghi chú. Chừa các trường cấp số, thời điểm tạo và liên kết cho script. |
| NhatKy | Mỗi thao tác menu và mỗi lần quét ghi thời điểm, email, hành động, số hợp đồng nếu có và kết quả hoặc lỗi. |

ID của mẫu nằm giữa `/document/d/` và `/edit` trên URL. ID thư mục nằm sau `/folders/`. Người tạo hợp đồng cần quyền đọc/sao chép mẫu và quyền tạo tệp ở thư mục đích. Người nhận email cần quyền đọc tệp qua Drive để mở liên kết. Phiên bản này dùng My Drive.

Trước khi chia sẻ Sheet, chủ sở hữu vào **Dữ liệu → Bảo vệ trang tính và dải ô**, giới hạn quyền sửa **CauHinh** và **Mau** cho quản trị viên. Danh sách người duyệt và nơi lưu tài liệu nằm ở hai tab này. Người dùng cần quyền ghi **NhatKy** để thao tác qua menu. Vì người có quyền sửa Sheet cũng có thể sửa bound script, quy trình phù hợp với nhóm nội bộ tin cậy.

## Soạn mẫu Docs

Đặt nguyên khóa viết hoa trong hai cặp ngoặc nhọn, cùng một đoạn văn và cùng định dạng. Có thể đặt khóa vào bảng, đầu trang, chân trang hoặc tab con. Tắt **Different first page header/footer** trên biểu mẫu. Đầu trang riêng của trang đầu cần hỗ trợ nâng cao ngoài DocumentApp.

| Nội dung | Khóa mẫu |
| --- | --- |
| Hợp đồng | `{{SO_HD}}`, `{{LOAI_HD}}`, `{{NGAY_KY}}`, `{{NGAY_HIEU_LUC}}`, `{{NGAY_HET_HAN}}`, `{{GIA_TRI}}`, `{{GIA_TRI_BANG_CHU}}`, `{{DIEU_KHOAN_THANH_TOAN}}`, `{{NGUOI_PHU_TRACH}}`, `{{TRANG_THAI}}`, `{{GHI_CHU}}` |
| Khách hàng | `{{MA_KH}}`, `{{TEN_KH}}`, `{{DIA_CHI_KH}}`, `{{MST_KH}}`, `{{DAI_DIEN_KH}}`, `{{CHUC_VU_KH}}`, `{{SDT_KH}}`, `{{EMAIL_KH}}`, `{{TAI_KHOAN_NH_KH}}`. Các tên cột gốc của KhachHang viết hoa cũng dùng được. |
| Bên bán | `{{TEN_BEN_BAN}}`, `{{MST_BEN_BAN}}`, `{{DIA_CHI_BEN_BAN}}`, `{{DAI_DIEN_BEN_BAN}}`, `{{CHUC_VU_BEN_BAN}}` |
| Mẫu cũ | `{{DIEU_KHOAN_TT}}` cùng lấy giá trị điều khoản thanh toán. |

Tiền được làm tròn đến đồng. Ví dụ, 15.500.000 cho kết quả “Mười lăm triệu năm trăm nghìn đồng”. Ngày được điền theo định dạng ngày/tháng/năm. Chủ mẫu cần kiểm tra chính tả của khóa trong bản PDF nghiệm thu.

## Tạo, duyệt và xuất lại

1. Chọn một ô trên dòng dữ liệu của **HopDong**. Bấm **Hợp đồng → Tạo hợp đồng từ dòng đang chọn**. Với thư mục mặc định, đường dẫn lưu là `ROOT_FOLDER_ID / năm cấp số / tên khách hàng`. Tên Docs và PDF gồm số hợp đồng và tên khách.
2. Mở **Link_Docs** và **Link_PDF** để kiểm tra nội dung. Số có dạng `HDDV-2026-0001`. Một khóa chung bảo vệ bước cấp số, bộ đếm lưu theo tiền tố và năm. Số đã cấp có thể bị khuyết khi gặp lỗi. Khi thử lại, giữ nguyên số trên dòng. Nếu đã ghi link Docs, ứng dụng có thể tiếp tục xuất PDF. Sau lần chạy bị dừng ở giữa, khóa xuất của riêng hợp đồng tự hết hạn sau bảy phút.
3. **Tạo lại PDF** xuất phiên bản hiện tại của bản Docs đã liên kết và cập nhật **Link_PDF**. Bản PDF trước vẫn nằm trong Drive. Nếu dữ liệu thương mại thay đổi trong lúc còn nháp, cập nhật và đối chiếu cả bản Docs trước khi xuất lại và trình duyệt. Khi lập số mới, dùng dòng mới và để trống số cùng các cột theo dõi.
4. Dùng menu **Gửi duyệt → Phê duyệt → Đánh dấu đã ký**. Có thể trả về nháp từ Chờ duyệt, hoặc hủy từ Nháp, Chờ duyệt, Đã duyệt. Chỉ email thuộc **NGUOI_DUYET** được duyệt, đánh dấu đã ký hoặc hủy một hợp đồng đã duyệt. Khi duyệt, script khóa các cột nội dung của dòng và giữ quyền cho chủ sở hữu cùng người duyệt. Các cột trạng thái, liên kết và ghi chú là cột vận hành. Chuyển trạng thái qua menu để chạy kiểm tra quyền, tạo vùng khóa và ghi nhật ký. Sửa tay dropdown sẽ bỏ qua các bước đó. Quyền sửa bản Docs và PDF được quản lý riêng trên Drive.
5. **Mở thư mục lưu** hiển thị liên kết thư mục của hợp đồng. Nếu thao tác báo lỗi, xem **NhatKy** cùng quyền trên mẫu, thư mục và dải ô tương ứng.

## Cài lịch nhắc

Chủ sở hữu chọn **Hợp đồng → Cài nhắc hạn hàng ngày** hoặc chạy **installDailyTrigger** trong Apps Script. Mục **Triggers** sẽ có một lịch theo ngày cho **runDailyContractScan**, trong khung 8–9 giờ Việt Nam. Cài lại bằng cùng tài khoản sẽ dùng lại lịch chung. Khi đổi chủ sở hữu, chủ cũ xóa lịch của mình trước khi chủ mới cài lại.

Bộ quét chỉ xét hợp đồng **Đã duyệt** hoặc **Đã ký**. Qua ngày hết hạn, trạng thái chuyển thành **Hết hạn**. Đúng ngày khớp một mốc nhắc, hệ thống gom các hợp đồng vào một email HTML kèm liên kết, gửi tới danh sách đã cấu hình. Múi giờ của Sheet và script phải cùng là giờ Việt Nam. Nút **Quét hết hạn** chạy cùng nghiệp vụ ngay lập tức, kể cả bước gửi email. Lịch và menu dùng chung dấu ghi nhận ngày gửi thành công. Nếu thiếu hạn mức, các trạng thái quá hạn vẫn được cập nhật và người vận hành có thể quét lại trong ngày khi đủ hạn mức.

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
