import React from 'react';
import './StyledButton.css';

// Đổi tên class cơ sở thành 'styled-button' để khớp với file CSS bạn gửi lần trước
const StyledButton = ({ children, onClick, type = 'default', loading = false, danger = false, ...props }) => {
  
  // Logic để tạo chuỗi className
  const classes = ['styled-button']; // Dùng class cơ sở
  if (danger) {
    classes.push('danger');
  }
  if (type === 'link') {
    classes.push('link'); // Thêm class 'link' nếu type là 'link'
  }

  // Xử lý để type của thẻ button luôn hợp lệ
  // Nếu type là 'link', chúng ta sẽ dùng 'button' cho HTML, nếu không thì giữ nguyên
  const htmlButtonType = (type === 'link' || type === 'default') ? 'button' : type;

  return (
    <button
      className={classes.join(' ')} // Nối các class lại với nhau
      onClick={onClick}
      type={htmlButtonType} // Sử dụng type hợp lệ cho HTML
      disabled={loading}
      {...props}
    >
      {loading ? 'Đang xử lý...' : children}
    </button>
  );
};

export default StyledButton;