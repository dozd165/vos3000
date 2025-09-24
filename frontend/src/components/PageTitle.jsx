import React from 'react';
import './PageTitle.css'; // Import CSS cho component

const PageTitle = ({ children }) => {
  return (
    <div className="page-title-container">
      <h2 className="page-title-text">{children}</h2>
    </div>
  );
};

export default PageTitle;