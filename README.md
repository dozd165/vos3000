Hệ Thống Quản Lý VOS3000 (VOS3000 Management Suite)
Một nền tảng quản lý tập trung, hiện đại được xây dựng để đơn giản hóa việc vận hành và giám sát nhiều máy chủ VOS3000.
🎯 Mục Tiêu Dự Án
Dự án này được tái cấu trúc từ một ứng dụng Streamlit sang kiến trúc API + Frontend chuyên biệt nhằm các mục tiêu:
Khả năng mở rộng: Dễ dàng thêm tính năng và tích hợp với các hệ thống khác.
Hiệu suất: Tối ưu hóa tốc độ xử lý các tác vụ quét dữ liệu lớn.
Bảo mật: Triển khai các cơ chế xác thực và phân quyền mạnh mẽ.
Bảo trì: Tách biệt logic và giao diện giúp việc phát triển và sửa lỗi trở nên độc lập, dễ dàng.
Trải nghiệm người dùng (UX): Cung cấp một giao diện người dùng hiện đại, linh hoạt và chuyên nghiệp.
🛠️ Công Nghệ Sử Dụng (Tech Stack)
Backend
Framework: FastAPI
Server: Uvicorn + Gunicorn
Ngôn ngữ: Python 3.9+
Thư viện chính: Pydantic (validation), Requests (HTTP client)
Frontend
Framework: React (sử dụng Vite)
Thư viện UI: Ant Design
Quản lý Trạng thái: Redux Toolkit
Thư viện gọi API: Axios
🚀 Hướng Dẫn Bắt Đầu (Getting Started)
Cài đặt Backend
Di chuyển vào thư mục backend:
cd backend


Tạo và kích hoạt môi trường ảo:
python -m venv venv
source venv/bin/activate # macOS/Linux
# Hoặc .\\venv\\Scripts\\activate cho Windows


Cài đặt các gói phụ thuộc:
pip install -r requirements.txt


Chạy server phát triển:
uvicorn app.main:app --reload


API sẽ có tại http://127.0.0.1:8000 và tài liệu tương tác tại http://127.0.0.1:8000/docs.
Cài đặt Frontend
(Sẽ được cập nhật ở Giai Đoạn 2)
📂 Cấu Trúc Dự Án
.
├── backend/            # Chứa toàn bộ code cho API server
│   ├── app/
│   │   ├── api/        # Các file định nghĩa API endpoints
│   │   ├── core/       # Cấu hình của backend
│   │   ├── services/   # Logic nghiệp vụ (các file *_management.py)
│   │   └── main.py     # File khởi chạy FastAPI
│   ├── requirements.txt
│   └── ...
├── frontend/           # Chứa toàn bộ code cho giao diện người dùng
│   ├── src/
│   └── ...
└── .gitignore          # Các file và thư mục được Git bỏ qua
└── README.md           # File giới thiệu dự án này


