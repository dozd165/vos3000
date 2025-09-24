import React from 'react';
import './StyledButton.css';

const StyledButton = ({ children, onClick, type = 'button', loading = false, danger = false, ...props }) => {
  const buttonClassName = `custom-styled-button ${danger ? 'danger' : ''}`;

  return (
    <button
      className={buttonClassName}
      onClick={onClick}
      type={type}
      disabled={loading}
      {...props}
    >
      {loading ? 'Đang xử lý...' : children}
    </button>
  );
};

export default StyledButton;