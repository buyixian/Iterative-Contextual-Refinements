import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ children, variant = 'secondary', ...props }: ButtonProps) {
  const className = `btn ${variant}`;
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}