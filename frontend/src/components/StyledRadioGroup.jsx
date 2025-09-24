// frontend/src/components/StyledRadioGroup.jsx
import React from 'react';
import './StyledRadioGroup.css';

const StyledRadioGroup = ({ options, name, value, onChange }) => {
  return (
    <div className="radio-inputs">
      {options.map((option) => (
        <label className="radio" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="name">{option.label}</span>
        </label>
      ))}
    </div>
  );
};

export default StyledRadioGroup;